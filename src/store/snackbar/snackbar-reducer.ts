// Copyright (C) The Arvados Authors. All rights reserved.
//
// SPDX-License-Identifier: AGPL-3.0

import { SnackbarAction, snackbarActions, SnackbarKind, SnackbarMessage } from "./snackbar-actions";

export interface SnackbarState {
    messages: SnackbarMessage[];
    open: boolean;
}

const DEFAULT_HIDE_DURATION = 3000;

const initialState: SnackbarState = {
    messages: [],
    open: false
};

export const snackbarReducer = (state = initialState, action: SnackbarAction) => {
    return snackbarActions.match(action, {
        OPEN_SNACKBAR: data => {
            return {
                open: true,
                messages: state.messages.concat({
                    message: data.message,
                    hideDuration: data.hideDuration ? data.hideDuration : DEFAULT_HIDE_DURATION,
                    kind: data.kind ? data.kind : SnackbarKind.INFO
                })
            };
        },
        CLOSE_SNACKBAR: () => ({
            ...state,
            open: false
        }),
        SHIFT_MESSAGES: () => {
            const messages = state.messages.filter((m, idx) => idx > 0);
            return {
                open: messages.length > 0,
                messages
            };
        },
        default: () => state,
    });
};
