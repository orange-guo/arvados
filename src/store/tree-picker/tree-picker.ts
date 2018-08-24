// Copyright (C) The Arvados Authors. All rights reserved.
//
// SPDX-License-Identifier: AGPL-3.0

import { Tree } from "~/models/tree";
import { TreeItemStatus } from "~/components/tree/tree";
import { RootState } from '~/store/store';

export type TreePicker = { [key: string]: Tree<TreePickerNode> };

export interface TreePickerNode {
    nodeId: string;
    value: any;
    selected: boolean;
    collapsed: boolean;
    status: TreeItemStatus;
}

export const createTreePickerNode = (data: { nodeId: string, value: any }) => ({
    ...data,
    selected: false,
    collapsed: true,
    status: TreeItemStatus.INITIAL
});

export const getTreePicker = (id: string) => (state: TreePicker): Tree<TreePickerNode> | undefined => state[id];