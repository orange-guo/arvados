// Copyright (C) The Arvados Authors. All rights reserved.
//
// SPDX-License-Identifier: AGPL-3.0

import { IconType } from "components/icon/icon";
import { ContextMenuAction } from "../context-menu/context-menu-action-set";

export const MultiSelectMenuActionNames = {
  MAKE_A_COPY: "Make a copy",
  MOVE_TO: "Move to",
  TOGGLE_TRASH_ACTION: "ToggleTrashAction",
  TOGGLE_FAVORITE_ACTION: "ToggleFavoriteAction",
  COPY_TO_CLIPBOARD: "Copy to clipboard",
  COPY_AND_RERUN_PROCESS: "Copy and re-run process",
  REMOVE: "Remove",
};

export interface MultiSelectMenuAction extends ContextMenuAction {
    defaultText?: string;
    altText?: string;
    altIcon?: IconType;
    isDefault?: () => boolean;
}

export type MultiSelectMenuActionSet = Array<Array<MultiSelectMenuAction>>;
