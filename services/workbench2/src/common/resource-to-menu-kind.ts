// Copyright (C) The Arvados Authors. All rights reserved.
//
// SPDX-License-Identifier: AGPL-3.0

import { Dispatch } from 'redux';
import { RootState } from 'store/store';
import { AuthState } from 'store/auth/auth-reducer';
import { getResource } from 'store/resources/resources';
import { Resource, TrashableResource, ResourceKind } from 'models/resource';
import { resourceIsFrozen } from 'common/frozen-resources';
import { GroupResource, GroupClass } from 'models/group';
import { ContextMenuKind } from 'views-components/context-menu/menu-item-sort';
import { getProcess, isProcessCancelable } from 'store/processes/process';
import { CollectionResource } from 'models/collection';
import { User } from 'models/user';
import { ResourcesState } from 'store/resources/resources';

type ProjectToMenuArgs = {
    isAdmin: boolean;
    readonly: boolean;
    isFrozen: boolean;
    canManage: boolean;
    canWrite: boolean;
    isFilterGroup: boolean;
    unfreezeRequiresAdmin: boolean;
    isEditable: boolean;
};

type CollectionToMenuArgs = {
    isAdmin: boolean;
    isEditable: boolean;
    isOnlyWriteable: boolean;
    isOldVersion: boolean;
    isTrashed: boolean;
};

type ProcessToMenuArgs = {
    isAdmin: boolean;
    isRunning: boolean;
    canWriteProcess: boolean;
};

type MenuKindResource = Pick<Resource, 'uuid' | 'kind'> &
    Pick<TrashableResource, 'isTrashed'> &
    Pick<GroupResource, 'name' | 'groupClass' | 'canWrite' | 'canManage'> &
    Pick<CollectionResource, 'currentVersionUuid' | 'ownerUuid'> &
    Pick<User, 'isAdmin'>;

export const resourceToMenuKind =
    (uuid: string, readonly = false) =>
    (dispatch: Dispatch, getState: () => RootState): ContextMenuKind | undefined => {
        const { auth, resources } = getState();
        const resource = getResource(uuid)(resources) as unknown as MenuKindResource;
        if (!resource) return;
        const { kind, canManage = false, canWrite = false } = resource;
        const isAdmin = auth.user?.isAdmin || false;
        const isFrozen = resourceIsFrozen(resource, resources);
        const isEditable = getIsEditable(isAdmin, resource, resources, readonly, isFrozen);

        switch (kind) {
            case ResourceKind.PROJECT:
                const unfreezeRequiresAdmin = getUnfreezeRequiresAdmin(auth);
                const isFilterGroup = resource.groupClass === GroupClass.FILTER;
                return getProjectMenuKind({ isAdmin, isFrozen, isEditable, canManage, canWrite, unfreezeRequiresAdmin, isFilterGroup, readonly });
            case ResourceKind.COLLECTION:
                const collectionParent = getResource<GroupResource>(resource.ownerUuid)(resources);
                const isOnlyWriteable = collectionParent?.canWrite === true && collectionParent.canManage === false;
                const isOldVersion = resource.uuid !== resource.currentVersionUuid;
                const isTrashed = resource.isTrashed || false;
                return getCollectionMenuKind({ isAdmin, isEditable, isOldVersion, isTrashed, isOnlyWriteable });
            case ResourceKind.PROCESS:
                const process = getProcess(uuid)(resources);
                const canWriteProcess = process ? getResource<any>(process.containerRequest.ownerUuid)(resources).canWrite : false;
                const isRunning = process ? isProcessCancelable(process) : false;
                return getProcessMenuKind({ isAdmin, isRunning, canWriteProcess });
            case ResourceKind.USER:
                return ContextMenuKind.ROOT_PROJECT;
            case ResourceKind.LINK:
                return ContextMenuKind.LINK;
            case ResourceKind.WORKFLOW:
                return isEditable ? ContextMenuKind.WORKFLOW : ContextMenuKind.READONLY_WORKFLOW;
            default:
                return;
        }
    };

const getProjectMenuKind = ({ isAdmin, readonly, isFrozen, canManage, canWrite, unfreezeRequiresAdmin, isEditable, isFilterGroup }: ProjectToMenuArgs) => {
    if (isFrozen) {
        if (isAdmin) {
            return ContextMenuKind.FROZEN_PROJECT_ADMIN;
        }
        if (canManage) {
            if (unfreezeRequiresAdmin) return ContextMenuKind.MANAGEABLE_PROJECT;
            return ContextMenuKind.FROZEN_MANAGEABLE_PROJECT;
        }
        if (isEditable) {
            return ContextMenuKind.FROZEN_PROJECT;
        }
        return ContextMenuKind.READONLY_PROJECT;
    }

    if (isAdmin && !readonly) {
        if (isFilterGroup) return ContextMenuKind.FILTER_GROUP_ADMIN;
        return ContextMenuKind.PROJECT_ADMIN;
    }

    if (canManage === false && canWrite === true) {
        return ContextMenuKind.WRITEABLE_PROJECT;
    }

    if (!isEditable) {
        return ContextMenuKind.READONLY_PROJECT;
    }

    if (isFilterGroup) return ContextMenuKind.FILTER_GROUP;

    return ContextMenuKind.PROJECT;
};

const getCollectionMenuKind = ({ isAdmin, isEditable, isOnlyWriteable, isOldVersion, isTrashed }: CollectionToMenuArgs) => {
    if (isOldVersion) {
        return ContextMenuKind.OLD_VERSION_COLLECTION;
    }

    if (isTrashed && isEditable) {
        return ContextMenuKind.TRASHED_COLLECTION;
    }

    if (isAdmin && isEditable) {
        return ContextMenuKind.COLLECTION_ADMIN;
    }

    if (!isEditable) {
        return ContextMenuKind.READONLY_COLLECTION;
    }

    return isOnlyWriteable ? ContextMenuKind.WRITEABLE_COLLECTION : ContextMenuKind.COLLECTION;
};

const getProcessMenuKind = ({ isAdmin, isRunning, canWriteProcess }: ProcessToMenuArgs): ContextMenuKind => {
    if (isAdmin) {
        return isRunning ? ContextMenuKind.RUNNING_PROCESS_ADMIN : ContextMenuKind.PROCESS_ADMIN;
    }

    if (isRunning) {
        return ContextMenuKind.RUNNING_PROCESS_RESOURCE;
    }

    return canWriteProcess ? ContextMenuKind.PROCESS_RESOURCE : ContextMenuKind.READONLY_PROCESS_RESOURCE;
};

//Utils--------------------------------------------------------------
const getUnfreezeRequiresAdmin = (auth: AuthState) => {
    const { remoteHostsConfig } = auth;
    if (!remoteHostsConfig) return false;
    return Object.keys(remoteHostsConfig).some((k) => remoteHostsConfig[k].clusterConfig.API.UnfreezeProjectRequiresAdmin);
};

const getIsEditable = (isAdmin: boolean, resource: MenuKindResource, resources: ResourcesState, readonly: boolean, isFrozen: boolean) => {
    const isEditable = (resources[resource.ownerUuid] as GroupResource)?.canWrite || resource.canWrite;
    return (isAdmin || isEditable) && !readonly && !isFrozen;
};
