// Copyright (C) The Arvados Authors. All rights reserved.
//
// SPDX-License-Identifier: AGPL-3.0

import { Dispatch } from "redux";
import { connect } from "react-redux";
import { RootState } from 'store/store';
import {
    openContextMenu,
} from 'store/context-menu/context-menu-actions';
import {
    LinkPanelRoot,
    LinkPanelRootActionProps,
    LinkPanelRootDataProps
} from 'views/link-panel/link-panel-root';
import { ResourceKind } from 'models/resource';
import { LinkResource } from 'models/link';
import { resourceToMenuKind } from 'common/resource-to-menu-kind';

const mapStateToProps = (state: RootState): LinkPanelRootDataProps => {
    return {
        resources: state.resources
    };
};

const mapDispatchToProps = (dispatch: Dispatch): LinkPanelRootActionProps => ({
    onContextMenu: (event, resource: LinkResource) => {
        const kind = dispatch<any>(resourceToMenuKind(resource.uuid));
        if (kind) {
            dispatch<any>(openContextMenu(event, {
                name: '',
                uuid: resource.uuid,
                ownerUuid: '',
                kind: ResourceKind.LINK,
                menuKind: kind
            }));
        }
    },
    onItemClick: (resource: LinkResource) => { return; },
    onItemDoubleClick: uuid => { return; }
});

export const LinkPanel = connect(mapStateToProps, mapDispatchToProps)(LinkPanelRoot);