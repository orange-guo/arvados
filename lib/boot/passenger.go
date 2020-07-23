// Copyright (C) The Arvados Authors. All rights reserved.
//
// SPDX-License-Identifier: AGPL-3.0

package boot

import (
	"bytes"
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"git.arvados.org/arvados.git/sdk/go/arvados"
)

// Don't trust "passenger-config" (or "bundle install") to handle
// concurrent installs.
var passengerInstallMutex sync.Mutex

var railsEnv = []string{
	"ARVADOS_RAILS_LOG_TO_STDOUT=1",
	"ARVADOS_CONFIG_NOLEGACY=1", // don't load database.yml from source tree
}

// Install a Rails application's dependencies, including phusion
// passenger.
type installPassenger struct {
	src     string
	depends []supervisedTask
}

func (runner installPassenger) String() string {
	return "installPassenger:" + runner.src
}

func (runner installPassenger) Run(ctx context.Context, fail func(error), super *Supervisor) error {
	if super.ClusterType == "production" {
		// passenger has already been installed via package
		return nil
	}
	err := super.wait(ctx, runner.depends...)
	if err != nil {
		return err
	}

	passengerInstallMutex.Lock()
	defer passengerInstallMutex.Unlock()

	var buf bytes.Buffer
	err = super.RunProgram(ctx, runner.src, &buf, nil, "gem", "list", "--details", "bundler")
	if err != nil {
		return err
	}
	for _, version := range []string{"1.16.6", "1.17.3", "2.0.2"} {
		if !strings.Contains(buf.String(), "("+version+")") {
			err = super.RunProgram(ctx, runner.src, nil, nil, "gem", "install", "--user", "--conservative", "--no-rdoc", "--no-ri", "bundler:1.16.6", "bundler:1.17.3", "bundler:2.0.2")
			if err != nil {
				return err
			}
			break
		}
	}
	err = super.RunProgram(ctx, runner.src, nil, nil, "bundle", "install", "--jobs", "4", "--path", filepath.Join(os.Getenv("HOME"), ".gem"))
	if err != nil {
		return err
	}
	err = super.RunProgram(ctx, runner.src, nil, nil, "bundle", "exec", "passenger-config", "build-native-support")
	if err != nil {
		return err
	}
	err = super.RunProgram(ctx, runner.src, nil, nil, "bundle", "exec", "passenger-config", "install-standalone-runtime")
	if err != nil {
		return err
	}
	err = super.RunProgram(ctx, runner.src, nil, nil, "bundle", "exec", "passenger-config", "validate-install")
	if err != nil && !strings.Contains(err.Error(), "exit status 2") {
		// Exit code 2 indicates there were warnings (like
		// "other passenger installations have been detected",
		// which we can't expect to avoid) but no errors.
		// Other non-zero exit codes (1, 9) indicate errors.
		return err
	}
	return nil
}

type runPassenger struct {
	src       string // path to app in source tree
	varlibdir string // path to app (relative to /var/lib/arvados) in OS package
	svc       arvados.Service
	depends   []supervisedTask
}

func (runner runPassenger) String() string {
	return "runPassenger:" + runner.src
}

func (runner runPassenger) Run(ctx context.Context, fail func(error), super *Supervisor) error {
	err := super.wait(ctx, runner.depends...)
	if err != nil {
		return err
	}
	port, err := internalPort(runner.svc)
	if err != nil {
		return fmt.Errorf("bug: no internalPort for %q: %v (%#v)", runner, err, runner.svc)
	}
	var appdir string
	if super.ClusterType == "production" {
		appdir = "/var/lib/arvados/" + runner.varlibdir
	} else {
		appdir = runner.src
	}
	loglevel := "4"
	if lvl, ok := map[string]string{
		"debug":   "5",
		"info":    "4",
		"warn":    "2",
		"warning": "2",
		"error":   "1",
		"fatal":   "0",
		"panic":   "0",
	}[super.cluster.SystemLogs.LogLevel]; ok {
		loglevel = lvl
	}
	super.waitShutdown.Add(1)
	go func() {
		defer super.waitShutdown.Done()
		cmdline := []string{
			"bundle", "exec",
			"passenger", "start",
			"-p", port,
			"--log-level", loglevel,
			"--no-friendly-error-pages",
			"--disable-anonymous-telemetry",
			"--disable-security-update-check",
			"--no-compile-runtime",
			"--no-install-runtime",
			"--pid-file", filepath.Join(super.wwwtempdir, "passenger."+strings.Replace(appdir, "/", "_", -1)+".pid"),
		}
		if super.ClusterType == "production" {
			cmdline = append([]string{"sudo", "-u", "www-data", "-E", "HOME=/var/www", "PATH=/var/lib/arvados/bin:" + os.Getenv("PATH"), "/var/lib/arvados/bin/bundle"}, cmdline[1:]...)
		} else {
			// This would be desirable in the production
			// case too, but it fails with sudo because
			// /dev/stderr is a symlink to a pty owned by
			// root: "nginx: [emerg] open() "/dev/stderr"
			// failed (13: Permission denied)"
			cmdline = append(cmdline, "--log-file", "/dev/stderr")
		}
		env := append([]string{"TMPDIR=" + super.wwwtempdir}, railsEnv...)
		err = super.RunProgram(ctx, appdir, nil, env, cmdline[0], cmdline[1:]...)
		fail(err)
	}()
	return nil
}
