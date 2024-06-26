// Copyright (C) The Arvados Authors. All rights reserved.
//
// SPDX-License-Identifier: AGPL-3.0

package controller

import (
	"context"
	"time"

	"git.arvados.org/arvados.git/lib/controller/dblock"
	"git.arvados.org/arvados.git/sdk/go/auth"
	"git.arvados.org/arvados.git/sdk/go/ctxlog"
)

func (h *Handler) periodicWorker(workerName string, interval time.Duration, locker *dblock.DBLocker, run func(context.Context) error) {
	logger := ctxlog.FromContext(h.BackgroundContext).WithField("worker", workerName)
	ctx := ctxlog.Context(h.BackgroundContext, logger)
	if interval <= 0 {
		logger.Debugf("interval is %v, not running worker", interval)
		return
	}
	if !locker.Lock(ctx, h.dbConnector.GetDB) {
		// context canceled
		return
	}
	defer locker.Unlock()
	for time.Sleep(interval); ctx.Err() == nil; time.Sleep(interval) {
		if !locker.Check() {
			// context canceled
			return
		}
		err := run(ctx)
		if err != nil {
			logger.WithError(err).Infof("%s failed", workerName)
		}
	}
}

func (h *Handler) trashSweepWorker() {
	h.periodicWorker("trash sweep", h.Cluster.Collections.TrashSweepInterval.Duration(), dblock.TrashSweep, func(ctx context.Context) error {
		ctx = auth.NewContext(ctx, &auth.Credentials{Tokens: []string{h.Cluster.SystemRootToken}})
		_, err := h.federation.SysTrashSweep(ctx, struct{}{})
		return err
	})
}

func (h *Handler) containerLogSweepWorker() {
	h.periodicWorker("container log sweep", h.Cluster.Containers.Logging.SweepInterval.Duration(), dblock.ContainerLogSweep, func(ctx context.Context) error {
		db, err := h.dbConnector.GetDB(ctx)
		if err != nil {
			return err
		}
		res, err := db.ExecContext(ctx, `
DELETE FROM logs
 USING containers
 WHERE logs.object_uuid=containers.uuid
 AND logs.event_type in ('stdout', 'stderr', 'arv-mount', 'crunch-run', 'crunchstat', 'hoststat', 'node', 'container', 'keepstore')
 AND containers.log IS NOT NULL
 AND now() - containers.finished_at > $1::interval`,
			h.Cluster.Containers.Logging.MaxAge.String())
		if err != nil {
			return err
		}
		logger := ctxlog.FromContext(ctx)
		rows, err := res.RowsAffected()
		if err != nil {
			logger.WithError(err).Warn("unexpected error from RowsAffected()")
		} else {
			logger.WithField("rows", rows).Info("deleted rows from logs table")
		}
		return nil
	})
}
