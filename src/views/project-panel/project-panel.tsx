// Copyright (C) The Arvados Authors. All rights reserved.
//
// SPDX-License-Identifier: AGPL-3.0

import * as React from 'react';
import { Button, StyleRulesCallback, WithStyles, withStyles } from '@material-ui/core';
import { DataExplorer } from "~/views-components/data-explorer/data-explorer";
import { DispatchProp, connect } from 'react-redux';
import { DataColumns } from '~/components/data-table/data-table';
import { RouteComponentProps } from 'react-router';
import { RootState } from '~/store/store';
import { DataTableFilterItem } from '~/components/data-table-filters/data-table-filters';
import { ContainerRequestState } from '~/models/container-request';
import { SortDirection } from '~/components/data-table/data-column';
import { ResourceKind } from '~/models/resource';
import { resourceLabel } from '~/common/labels';
import { ArvadosTheme } from '~/common/custom-theme';
import { ResourceFileSize, ResourceLastModifiedDate, ProcessStatus, ResourceType, ResourceOwner } from '~/views-components/data-explorer/renderers';
import { ProjectIcon } from '~/components/icon/icon';
import { ResourceName } from '~/views-components/data-explorer/renderers';
import { ResourcesState, getResource } from '~/store/resources/resources';
import { loadDetailsPanel } from '~/store/details-panel/details-panel-action';
import { ContextMenuKind } from '~/views-components/context-menu/context-menu';
import { contextMenuActions } from '~/store/context-menu/context-menu-actions';
import { CollectionResource } from '~/models/collection';
import { ProjectResource } from '~/models/project';
import { openProjectCreator } from '~/store/project/project-action';
import { reset } from 'redux-form';
import { COLLECTION_CREATE_DIALOG } from '~/views-components/dialog-create/dialog-collection-create';
import { collectionCreateActions } from '~/store/collections/creator/collection-creator-action';
import { navigateToResource } from '~/store/navigation/navigation-action';
import { getProperty } from '~/store/properties/properties';
import { PROJECT_PANEL_CURRENT_UUID } from '~/store/project-panel/project-panel-action';

type CssRules = 'root' | "toolbar" | "button";

const styles: StyleRulesCallback<CssRules> = (theme: ArvadosTheme) => ({
    root: {
        position: 'relative',
        width: '100%',
        height: '100%'
    },
    toolbar: {
        paddingBottom: theme.spacing.unit * 3,
        textAlign: "right"
    },
    button: {
        marginLeft: theme.spacing.unit
    },
});

export enum ProjectPanelColumnNames {
    NAME = "Name",
    STATUS = "Status",
    TYPE = "Type",
    OWNER = "Owner",
    FILE_SIZE = "File size",
    LAST_MODIFIED = "Last modified"
}

export interface ProjectPanelFilter extends DataTableFilterItem {
    type: ResourceKind | ContainerRequestState;
}

export const projectPanelColumns: DataColumns<string, ProjectPanelFilter> = [
    {
        name: ProjectPanelColumnNames.NAME,
        selected: true,
        configurable: true,
        sortDirection: SortDirection.ASC,
        filters: [],
        render: uuid => <ResourceName uuid={uuid} />,
        width: "450px"
    },
    {
        name: "Status",
        selected: true,
        configurable: true,
        sortDirection: SortDirection.NONE,
        filters: [
            {
                name: ContainerRequestState.COMMITTED,
                selected: true,
                type: ContainerRequestState.COMMITTED
            },
            {
                name: ContainerRequestState.FINAL,
                selected: true,
                type: ContainerRequestState.FINAL
            },
            {
                name: ContainerRequestState.UNCOMMITTED,
                selected: true,
                type: ContainerRequestState.UNCOMMITTED
            }
        ],
        render: uuid => <ProcessStatus uuid={uuid} />,
        width: "75px"
    },
    {
        name: ProjectPanelColumnNames.TYPE,
        selected: true,
        configurable: true,
        sortDirection: SortDirection.NONE,
        filters: [
            {
                name: resourceLabel(ResourceKind.COLLECTION),
                selected: true,
                type: ResourceKind.COLLECTION
            },
            {
                name: resourceLabel(ResourceKind.PROCESS),
                selected: true,
                type: ResourceKind.PROCESS
            },
            {
                name: resourceLabel(ResourceKind.PROJECT),
                selected: true,
                type: ResourceKind.PROJECT
            }
        ],
        render: uuid => <ResourceType uuid={uuid} />,
        width: "125px"
    },
    {
        name: ProjectPanelColumnNames.OWNER,
        selected: true,
        configurable: true,
        sortDirection: SortDirection.NONE,
        filters: [],
        render: uuid => <ResourceOwner uuid={uuid} />,
        width: "200px"
    },
    {
        name: ProjectPanelColumnNames.FILE_SIZE,
        selected: true,
        configurable: true,
        sortDirection: SortDirection.NONE,
        filters: [],
        render: uuid => <ResourceFileSize uuid={uuid} />,
        width: "50px"
    },
    {
        name: ProjectPanelColumnNames.LAST_MODIFIED,
        selected: true,
        configurable: true,
        sortDirection: SortDirection.NONE,
        filters: [],
        render: uuid => <ResourceLastModifiedDate uuid={uuid} />,
        width: "150px"
    }
];

export const PROJECT_PANEL_ID = "projectPanel";

interface ProjectPanelDataProps {
    currentItemId: string;
    resources: ResourcesState;
}

type ProjectPanelProps = ProjectPanelDataProps & DispatchProp
    & WithStyles<CssRules> & RouteComponentProps<{ id: string }>;

export const ProjectPanel = withStyles(styles)(
    connect((state: RootState) => ({
        currentItemId: getProperty(PROJECT_PANEL_CURRENT_UUID)(state.properties),
        resources: state.resources
    }))(
        class extends React.Component<ProjectPanelProps> {
            render() {
                const { classes } = this.props;
                return <div className={classes.root}>
                    <div className={classes.toolbar}>
                        <Button color="primary" onClick={this.handleNewCollectionClick} variant="raised" className={classes.button}>
                            Create a collection
                        </Button>
                        <Button color="primary" variant="raised" className={classes.button}>
                            Run a process
                        </Button>
                        <Button color="primary" onClick={this.handleNewProjectClick} variant="raised" className={classes.button}>
                            New project
                        </Button>
                    </div>
                    <DataExplorer
                        id={PROJECT_PANEL_ID}
                        onRowClick={this.handleRowClick}
                        onRowDoubleClick={this.handleRowDoubleClick}
                        onContextMenu={this.handleContextMenu}
                        defaultIcon={ProjectIcon}
                        defaultMessages={['Your project is empty.', 'Please create a project or create a collection and upload a data.']} />
                </div>;
            }

            handleNewProjectClick = () => {
                this.props.dispatch<any>(openProjectCreator(this.props.currentItemId));
            }

            handleNewCollectionClick = () => {
                this.props.dispatch(reset(COLLECTION_CREATE_DIALOG));
                this.props.dispatch(collectionCreateActions.OPEN_COLLECTION_CREATOR({ ownerUuid: this.props.currentItemId }));
            }

            handleContextMenu = (event: React.MouseEvent<HTMLElement>, resourceUuid: string) => {
                event.preventDefault();
                const resource = getResource(resourceUuid)(this.props.resources) as CollectionResource | ProjectResource | undefined;
                if (resource) {
                    let kind: ContextMenuKind;

                    if (resource.kind === ResourceKind.PROJECT) {
                        kind = ContextMenuKind.PROJECT;
                    } else if (resource.kind === ResourceKind.COLLECTION) {
                        kind = ContextMenuKind.COLLECTION_RESOURCE;
                    } else {
                        kind = ContextMenuKind.RESOURCE;
                    }
                    if (kind !== ContextMenuKind.RESOURCE) {
                        this.props.dispatch(
                            contextMenuActions.OPEN_CONTEXT_MENU({
                                position: { x: event.clientX, y: event.clientY },
                                resource: {
                                    uuid: resource.uuid,
                                    name: resource.name || '',
                                    description: resource.description,
                                    kind,
                                }
                            })
                        );
                    }
                }
            }

            handleRowDoubleClick = (uuid: string) => {
                this.props.dispatch<any>(navigateToResource(uuid));
            }

            handleRowClick = (uuid: string) => {
                this.props.dispatch(loadDetailsPanel(uuid));
            }

        }
    )
);
