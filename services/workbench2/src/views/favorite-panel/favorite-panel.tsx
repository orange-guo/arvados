// Copyright (C) The Arvados Authors. All rights reserved.
//
// SPDX-License-Identifier: AGPL-3.0

import React from 'react';
import { CustomStyleRulesCallback } from 'common/custom-theme';
import { WithStyles } from '@mui/styles';
import withStyles from '@mui/styles/withStyles';
import { DataExplorer } from "views-components/data-explorer/data-explorer";
import { connect, DispatchProp } from 'react-redux';
import { DataColumns } from 'components/data-table/data-column';
import { RouteComponentProps } from 'react-router';
import { DataTableFilterItem } from 'components/data-table-filters/data-table-filters';
import { ResourceKind } from 'models/resource';
import { ArvadosTheme } from 'common/custom-theme';
import { FAVORITE_PANEL_ID } from "store/favorite-panel/favorite-panel-action";
import {
    ProcessStatus,
    renderType,
    RenderName,
    RenderOwnerName,
    renderFileSize,
    renderLastModifiedDate,
} from 'views-components/data-explorer/renderers';
import { FavoriteIcon } from 'components/icon/icon';
import {
    openContextMenu,
} from 'store/context-menu/context-menu-actions';
import { loadDetailsPanel } from 'store/details-panel/details-panel-action';
import { navigateTo } from 'store/navigation/navigation-action';
import { ContainerRequestState } from "models/container-request";
import { FavoritesState } from 'store/favorites/favorites-reducer';
import { RootState } from 'store/store';
import { createTree } from 'models/tree';
import { getSimpleObjectTypeFilters } from 'store/resource-type-filters/resource-type-filters';
import { getResource, ResourcesState } from 'store/resources/resources';
import { GroupContentsResource } from 'services/groups-service/groups-service';
import { GroupClass, GroupResource } from 'models/group';
import { getProperty } from 'store/properties/properties';
import { PROJECT_PANEL_CURRENT_UUID } from "store/project-panel/project-panel";
import { CollectionResource } from 'models/collection';
import { toggleOne, deselectAllOthers } from 'store/multiselect/multiselect-actions';
import { resourceToMenuKind } from 'common/resource-to-menu-kind';

type CssRules = "toolbar" | "button" | "root";

const styles: CustomStyleRulesCallback<CssRules> = (theme: ArvadosTheme) => ({
    toolbar: {
        paddingBottom: theme.spacing(3),
        textAlign: "right"
    },
    button: {
        marginLeft: theme.spacing(1)
    },
    root: {
        width: '100%',
    },
});

export enum FavoritePanelColumnNames {
    NAME = "Name",
    STATUS = "Status",
    TYPE = "Type",
    OWNER = "Owner",
    FILE_SIZE = "File size",
    LAST_MODIFIED = "Last modified"
}

export interface FavoritePanelFilter extends DataTableFilterItem {
    type: ResourceKind | ContainerRequestState;
}

export const favoritePanelColumns: DataColumns<GroupContentsResource> = [
    {
        name: FavoritePanelColumnNames.NAME,
        selected: true,
        configurable: true,
        filters: createTree(),
        render: (resource) => <RenderName resource={resource} />,
    },
    {
        name: "Status",
        selected: true,
        configurable: true,
        filters: createTree(),
        render: (resource) => <ProcessStatus uuid={resource.uuid} />
    },
    {
        name: FavoritePanelColumnNames.TYPE,
        selected: true,
        configurable: true,
        filters: getSimpleObjectTypeFilters(),
        render: (resource) => renderType(resource),
    },
    {
        name: FavoritePanelColumnNames.OWNER,
        selected: false,
        configurable: true,
        filters: createTree(),
        render: (resource) => <RenderOwnerName resource={resource} />
    },
    {
        name: FavoritePanelColumnNames.FILE_SIZE,
        selected: true,
        configurable: true,
        filters: createTree(),
        render: (resource) => renderFileSize(resource),
    },
    {
        name: FavoritePanelColumnNames.LAST_MODIFIED,
        selected: true,
        configurable: true,
        filters: createTree(),
        render: (resource) => renderLastModifiedDate(resource),
    }
];

interface FavoritePanelDataProps {
    currentItemId: any;
    favorites: FavoritesState;
    resources: ResourcesState;
    userUuid: string;
}

const mapStateToProps = (state : RootState): FavoritePanelDataProps => ({
    favorites: state.favorites,
    resources: state.resources,
    userUuid: state.auth.user!.uuid,
    currentItemId: getProperty(PROJECT_PANEL_CURRENT_UUID)(state.properties),
});

type FavoritePanelProps = FavoritePanelDataProps & DispatchProp
    & WithStyles<CssRules> & RouteComponentProps<{ id: string }>;

export const FavoritePanel = withStyles(styles)(
    connect(mapStateToProps)(
        class extends React.Component<FavoritePanelProps> {

            handleContextMenu = (event: React.MouseEvent<HTMLElement>, resource: GroupContentsResource) => {
                const { resources } = this.props;

                let readonly = false;
                const project = getResource<GroupResource>(this.props.currentItemId)(resources);

                if (project && project.groupClass === GroupClass.FILTER) {
                    readonly = true;
                }

                const menuKind = this.props.dispatch<any>(resourceToMenuKind(resource.uuid, readonly));

                if (menuKind && resource) {
                    this.props.dispatch<any>(openContextMenu(event, {
                        name: resource.name,
                        uuid: resource.uuid,
                        ownerUuid: resource.ownerUuid,
                        isTrashed: ('isTrashed' in resource) ? resource.isTrashed: false,
                        kind: resource.kind,
                        menuKind,
                        description: resource.description,
                        storageClassesDesired: (resource as CollectionResource).storageClassesDesired,
                    }));
                }
                this.props.dispatch<any>(loadDetailsPanel(resource.uuid));
            }

            handleRowDoubleClick = ({uuid}: GroupContentsResource) => {
                this.props.dispatch<any>(navigateTo(uuid));
            }

            handleRowClick = ({uuid}: GroupContentsResource) => {
                this.props.dispatch<any>(toggleOne(uuid))
                this.props.dispatch<any>(deselectAllOthers(uuid))
                this.props.dispatch<any>(loadDetailsPanel(uuid));
            }

            render() {
                return <div className={this.props.classes.root}><DataExplorer
                    id={FAVORITE_PANEL_ID}
                    onRowClick={this.handleRowClick}
                    onRowDoubleClick={this.handleRowDoubleClick}
                    onContextMenu={this.handleContextMenu}
                    contextMenuColumn={false}
                    defaultViewIcon={FavoriteIcon}
                    defaultViewMessages={['Your favorites list is empty.']} />
                </div>;
            }
        }
    )
);
