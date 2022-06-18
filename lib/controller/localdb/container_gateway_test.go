// Copyright (C) The Arvados Authors. All rights reserved.
//
// SPDX-License-Identifier: AGPL-3.0

package localdb

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"fmt"
	"io"
	"io/ioutil"
	"net"
	"net/http/httptest"
	"time"

	"git.arvados.org/arvados.git/lib/config"
	"git.arvados.org/arvados.git/lib/controller/router"
	"git.arvados.org/arvados.git/lib/crunchrun"
	"git.arvados.org/arvados.git/sdk/go/arvados"
	"git.arvados.org/arvados.git/sdk/go/arvadostest"
	"git.arvados.org/arvados.git/sdk/go/auth"
	"git.arvados.org/arvados.git/sdk/go/ctxlog"
	"golang.org/x/crypto/ssh"
	check "gopkg.in/check.v1"
)

var _ = check.Suite(&ContainerGatewaySuite{})

type ContainerGatewaySuite struct {
	cluster *arvados.Cluster
	localdb *Conn
	ctx     context.Context
	ctrUUID string
	gw      *crunchrun.Gateway
}

func (s *ContainerGatewaySuite) TearDownSuite(c *check.C) {
	// Undo any changes/additions to the user database so they
	// don't affect subsequent tests.
	arvadostest.ResetEnv()
	c.Check(arvados.NewClientFromEnv().RequestAndDecode(nil, "POST", "database/reset", nil, nil), check.IsNil)
}

func (s *ContainerGatewaySuite) SetUpSuite(c *check.C) {
	cfg, err := config.NewLoader(nil, ctxlog.TestLogger(c)).Load()
	c.Assert(err, check.IsNil)
	s.cluster, err = cfg.GetCluster("")
	c.Assert(err, check.IsNil)
	s.localdb = NewConn(s.cluster)
	s.ctx = auth.NewContext(context.Background(), &auth.Credentials{Tokens: []string{arvadostest.ActiveTokenV2}})

	s.ctrUUID = arvadostest.QueuedContainerUUID

	h := hmac.New(sha256.New, []byte(s.cluster.SystemRootToken))
	fmt.Fprint(h, s.ctrUUID)
	authKey := fmt.Sprintf("%x", h.Sum(nil))

	rtr := router.New(s.localdb, router.Config{})
	srv := httptest.NewUnstartedServer(rtr)
	srv.StartTLS()
	ac := &arvados.Client{
		APIHost:   srv.Listener.Addr().String(),
		AuthToken: arvadostest.Dispatch1Token,
		Insecure:  true,
	}
	s.gw = &crunchrun.Gateway{
		ContainerUUID: s.ctrUUID,
		AuthSecret:    authKey,
		Address:       "localhost:0",
		Log:           ctxlog.TestLogger(c),
		Target:        crunchrun.GatewayTargetStub{},
		ArvadosClient: ac,
	}
	c.Assert(s.gw.Start(), check.IsNil)
	rootctx := auth.NewContext(context.Background(), &auth.Credentials{Tokens: []string{s.cluster.SystemRootToken}})
	_, err = s.localdb.ContainerUpdate(rootctx, arvados.UpdateOptions{
		UUID: s.ctrUUID,
		Attrs: map[string]interface{}{
			"state": arvados.ContainerStateLocked}})
	c.Assert(err, check.IsNil)
}

func (s *ContainerGatewaySuite) SetUpTest(c *check.C) {
	// clear any tunnel sessions started by previous test cases
	s.localdb.gwTunnelsLock.Lock()
	s.localdb.gwTunnels = nil
	s.localdb.gwTunnelsLock.Unlock()

	rootctx := auth.NewContext(context.Background(), &auth.Credentials{Tokens: []string{s.cluster.SystemRootToken}})
	_, err := s.localdb.ContainerUpdate(rootctx, arvados.UpdateOptions{
		UUID: s.ctrUUID,
		Attrs: map[string]interface{}{
			"state":           arvados.ContainerStateRunning,
			"gateway_address": s.gw.Address}})
	c.Assert(err, check.IsNil)

	s.cluster.Containers.ShellAccess.Admin = true
	s.cluster.Containers.ShellAccess.User = true
	_, err = arvadostest.DB(c, s.cluster).Exec(`update containers set interactive_session_started=$1 where uuid=$2`, false, s.ctrUUID)
	c.Check(err, check.IsNil)
}

func (s *ContainerGatewaySuite) TestConfig(c *check.C) {
	for _, trial := range []struct {
		configAdmin bool
		configUser  bool
		sendToken   string
		errorCode   int
	}{
		{true, true, arvadostest.ActiveTokenV2, 0},
		{true, false, arvadostest.ActiveTokenV2, 503},
		{false, true, arvadostest.ActiveTokenV2, 0},
		{false, false, arvadostest.ActiveTokenV2, 503},
		{true, true, arvadostest.AdminToken, 0},
		{true, false, arvadostest.AdminToken, 0},
		{false, true, arvadostest.AdminToken, 403},
		{false, false, arvadostest.AdminToken, 503},
	} {
		c.Logf("trial %#v", trial)
		s.cluster.Containers.ShellAccess.Admin = trial.configAdmin
		s.cluster.Containers.ShellAccess.User = trial.configUser
		ctx := auth.NewContext(s.ctx, &auth.Credentials{Tokens: []string{trial.sendToken}})
		sshconn, err := s.localdb.ContainerSSH(ctx, arvados.ContainerSSHOptions{UUID: s.ctrUUID})
		if trial.errorCode == 0 {
			if !c.Check(err, check.IsNil) {
				continue
			}
			if !c.Check(sshconn.Conn, check.NotNil) {
				continue
			}
			sshconn.Conn.Close()
		} else {
			c.Check(err, check.NotNil)
			err, ok := err.(interface{ HTTPStatus() int })
			if c.Check(ok, check.Equals, true) {
				c.Check(err.HTTPStatus(), check.Equals, trial.errorCode)
			}
		}
	}
}

func (s *ContainerGatewaySuite) TestDirectTCP(c *check.C) {
	// Set up servers on a few TCP ports
	var addrs []string
	for i := 0; i < 3; i++ {
		ln, err := net.Listen("tcp", ":0")
		c.Assert(err, check.IsNil)
		defer ln.Close()
		addrs = append(addrs, ln.Addr().String())
		go func() {
			for {
				conn, err := ln.Accept()
				if err != nil {
					return
				}
				var gotAddr string
				fmt.Fscanf(conn, "%s\n", &gotAddr)
				c.Logf("stub server listening at %s received string %q from remote %s", ln.Addr().String(), gotAddr, conn.RemoteAddr())
				if gotAddr == ln.Addr().String() {
					fmt.Fprintf(conn, "%s\n", ln.Addr().String())
				}
				conn.Close()
			}
		}()
	}

	c.Logf("connecting to %s", s.gw.Address)
	sshconn, err := s.localdb.ContainerSSH(s.ctx, arvados.ContainerSSHOptions{UUID: s.ctrUUID})
	c.Assert(err, check.IsNil)
	c.Assert(sshconn.Conn, check.NotNil)
	defer sshconn.Conn.Close()
	conn, chans, reqs, err := ssh.NewClientConn(sshconn.Conn, "zzzz-dz642-abcdeabcdeabcde", &ssh.ClientConfig{
		HostKeyCallback: func(hostname string, remote net.Addr, key ssh.PublicKey) error { return nil },
	})
	c.Assert(err, check.IsNil)
	client := ssh.NewClient(conn, chans, reqs)
	for _, expectAddr := range addrs {
		_, port, err := net.SplitHostPort(expectAddr)
		c.Assert(err, check.IsNil)

		c.Logf("trying foo:%s", port)
		{
			conn, err := client.Dial("tcp", "foo:"+port)
			c.Assert(err, check.IsNil)
			conn.SetDeadline(time.Now().Add(time.Second))
			buf, err := ioutil.ReadAll(conn)
			c.Check(err, check.IsNil)
			c.Check(string(buf), check.Equals, "")
		}

		c.Logf("trying localhost:%s", port)
		{
			conn, err := client.Dial("tcp", "localhost:"+port)
			c.Assert(err, check.IsNil)
			conn.SetDeadline(time.Now().Add(time.Second))
			conn.Write([]byte(expectAddr + "\n"))
			var gotAddr string
			fmt.Fscanf(conn, "%s\n", &gotAddr)
			c.Check(gotAddr, check.Equals, expectAddr)
		}
	}
}

func (s *ContainerGatewaySuite) TestConnect(c *check.C) {
	c.Logf("connecting to %s", s.gw.Address)
	sshconn, err := s.localdb.ContainerSSH(s.ctx, arvados.ContainerSSHOptions{UUID: s.ctrUUID})
	c.Assert(err, check.IsNil)
	c.Assert(sshconn.Conn, check.NotNil)
	defer sshconn.Conn.Close()

	done := make(chan struct{})
	go func() {
		defer close(done)

		// Receive text banner
		buf := make([]byte, 12)
		_, err := io.ReadFull(sshconn.Conn, buf)
		c.Check(err, check.IsNil)
		c.Check(string(buf), check.Equals, "SSH-2.0-Go\r\n")

		// Send text banner
		_, err = sshconn.Conn.Write([]byte("SSH-2.0-Fake\r\n"))
		c.Check(err, check.IsNil)

		// Receive binary
		_, err = io.ReadFull(sshconn.Conn, buf[:4])
		c.Check(err, check.IsNil)

		// If we can get this far into an SSH handshake...
		c.Logf("was able to read %x -- success, tunnel is working", buf[:4])
	}()
	select {
	case <-done:
	case <-time.After(time.Second):
		c.Fail()
	}
	ctr, err := s.localdb.ContainerGet(s.ctx, arvados.GetOptions{UUID: s.ctrUUID})
	c.Check(err, check.IsNil)
	c.Check(ctr.InteractiveSessionStarted, check.Equals, true)
}

func (s *ContainerGatewaySuite) TestConnectFail(c *check.C) {
	c.Log("trying with no token")
	ctx := auth.NewContext(context.Background(), &auth.Credentials{})
	_, err := s.localdb.ContainerSSH(ctx, arvados.ContainerSSHOptions{UUID: s.ctrUUID})
	c.Check(err, check.ErrorMatches, `.* 401 .*`)

	c.Log("trying with anonymous token")
	ctx = auth.NewContext(context.Background(), &auth.Credentials{Tokens: []string{arvadostest.AnonymousToken}})
	_, err = s.localdb.ContainerSSH(ctx, arvados.ContainerSSHOptions{UUID: s.ctrUUID})
	c.Check(err, check.ErrorMatches, `.* 404 .*`)
}

func (s *ContainerGatewaySuite) TestCreateTunnel(c *check.C) {
	// no AuthSecret
	conn, err := s.localdb.ContainerGatewayTunnel(s.ctx, arvados.ContainerGatewayTunnelOptions{
		UUID: s.ctrUUID,
	})
	c.Check(err, check.ErrorMatches, `authentication error`)
	c.Check(conn.Conn, check.IsNil)

	// bogus AuthSecret
	conn, err = s.localdb.ContainerGatewayTunnel(s.ctx, arvados.ContainerGatewayTunnelOptions{
		UUID:       s.ctrUUID,
		AuthSecret: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
	})
	c.Check(err, check.ErrorMatches, `authentication error`)
	c.Check(conn.Conn, check.IsNil)

	// good AuthSecret
	conn, err = s.localdb.ContainerGatewayTunnel(s.ctx, arvados.ContainerGatewayTunnelOptions{
		UUID:       s.ctrUUID,
		AuthSecret: s.gw.AuthSecret,
	})
	c.Check(err, check.IsNil)
	c.Check(conn.Conn, check.NotNil)
}

func (s *ContainerGatewaySuite) TestConnectThroughTunnel(c *check.C) {
	tungw := &crunchrun.Gateway{
		ContainerUUID: s.ctrUUID,
		AuthSecret:    s.gw.AuthSecret,
		Log:           ctxlog.TestLogger(c),
		Target:        crunchrun.GatewayTargetStub{},
		ArvadosClient: s.gw.ArvadosClient,
	}
	c.Assert(tungw.Start(), check.IsNil)

	// We didn't supply an external hostname in the Address field,
	// so Start() should assign a local address.
	host, _, err := net.SplitHostPort(tungw.Address)
	c.Assert(err, check.IsNil)
	c.Check(host, check.Equals, "127.0.0.1")

	// Set the gateway_address field to 127.0.0.1:badport to
	// ensure the ContainerSSH() handler connects through the
	// tunnel, rather than the gateway server on 127.0.0.1 (which
	// wouldn't work IRL where controller and gateway are on
	// different hosts, but would allow the test to cheat).
	rootctx := auth.NewContext(context.Background(), &auth.Credentials{Tokens: []string{s.cluster.SystemRootToken}})
	_, err = s.localdb.ContainerUpdate(rootctx, arvados.UpdateOptions{
		UUID: s.ctrUUID,
		Attrs: map[string]interface{}{
			"state":           arvados.ContainerStateRunning,
			"gateway_address": "127.0.0.1:0"}})
	c.Assert(err, check.IsNil)

	ctr, err := s.localdb.ContainerGet(s.ctx, arvados.GetOptions{UUID: s.ctrUUID})
	c.Check(err, check.IsNil)
	c.Check(ctr.InteractiveSessionStarted, check.Equals, false)
	c.Check(ctr.GatewayAddress, check.Equals, "127.0.0.1:0")

	c.Log("connecting to gateway through tunnel")
	sshconn, err := s.localdb.ContainerSSH(s.ctx, arvados.ContainerSSHOptions{UUID: s.ctrUUID})
	c.Assert(err, check.IsNil)
	c.Assert(sshconn.Conn, check.NotNil)
	defer sshconn.Conn.Close()

	done := make(chan struct{})
	go func() {
		defer close(done)

		// Receive text banner
		buf := make([]byte, 12)
		_, err := io.ReadFull(sshconn.Conn, buf)
		c.Check(err, check.IsNil)
		c.Check(string(buf), check.Equals, "SSH-2.0-Go\r\n")

		// Send text banner
		_, err = sshconn.Conn.Write([]byte("SSH-2.0-Fake\r\n"))
		c.Check(err, check.IsNil)

		// Receive binary
		_, err = io.ReadFull(sshconn.Conn, buf[:4])
		c.Check(err, check.IsNil)

		// If we can get this far into an SSH handshake...
		c.Logf("was able to read %x -- success, tunnel is working", buf[:4])
	}()
	select {
	case <-done:
	case <-time.After(time.Second):
		c.Fail()
	}
	ctr, err = s.localdb.ContainerGet(s.ctx, arvados.GetOptions{UUID: s.ctrUUID})
	c.Check(err, check.IsNil)
	c.Check(ctr.InteractiveSessionStarted, check.Equals, true)
}
