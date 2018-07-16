// Copyright (C) The Arvados Authors. All rights reserved.
//
// SPDX-License-Identifier: AGPL-3.0

import { connect, Dispatch, DispatchProp } from "react-redux";
import { RootState } from "../../store/store";
import actions from "../../store/context-menu/context-menu-actions";
import ContextMenu, { ContextMenuProps, ContextMenuItem } from "../../components/context-menu/context-menu";
import { createAnchorAt } from "../../components/popover/helpers";
import { ContextMenuResource } from "../../store/context-menu/context-menu-reducer";
import { ContextMenuActionSet, ContextMenuAction } from "./context-menu-action-set";
import { emptyActionSet } from "./action-sets/empty-action-set";

type DataProps = Pick<ContextMenuProps, "anchorEl" | "items"> & { resource?: ContextMenuResource };
const mapStateToProps = (state: RootState): DataProps => {
    const { position, resource } = state.contextMenu;
    return {
        anchorEl: resource ? createAnchorAt(position) : undefined,
        items: getMenuItemSet(resource),
        resource
    };
};

type ActionProps = Pick<ContextMenuProps, "onClose"> & { onItemClick: (item: ContextMenuItem, resource?: ContextMenuResource) => void };
const mapDispatchToProps = (dispatch: Dispatch): ActionProps => ({
    onClose: () => {
        dispatch(actions.CLOSE_CONTEXT_MENU());
    },
    onItemClick: (action: ContextMenuAction, resource?: ContextMenuResource) => {
        dispatch(actions.CLOSE_CONTEXT_MENU());
        if (resource) {
            action.execute(dispatch, resource);
        }
    }
});

const mergeProps = ({ resource, ...dataProps }: DataProps, actionProps: ActionProps): ContextMenuProps => ({
    ...dataProps,
    ...actionProps,
    onItemClick: item => {
        actionProps.onItemClick(item, resource);
    }
});

export const ContextMenuHOC = connect(mapStateToProps, mapDispatchToProps, mergeProps)(ContextMenu);

const menuItemSets = new Map<string, ContextMenuActionSet>();

export const addMenuItemsSet = (name: string, itemSet: ContextMenuActionSet) => {
    menuItemSets.set(name, itemSet);
};

const getMenuItemSet = (resource?: ContextMenuResource): ContextMenuActionSet => {
    return resource ? menuItemSets.get(resource.kind) || emptyActionSet : emptyActionSet;
};

