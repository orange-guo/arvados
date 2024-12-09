// Copyright (C) The Arvados Authors. All rights reserved.
//
// SPDX-License-Identifier: AGPL-3.0

import React from "react";
import { CustomStyleRulesCallback } from 'common/custom-theme';
import {
    Grid,
    Paper,
    Toolbar,
    TablePagination,
    IconButton,
    Tooltip,
    Button,
    Typography,
} from "@mui/material";
import { WithStyles } from '@mui/styles';
import withStyles from '@mui/styles/withStyles';
import { ColumnSelector } from "components/column-selector/column-selector";
import { DataColumns } from "components/data-table/data-column";
import { DataTable, DataTableFetchMode, DataTableItem } from "components/data-table/data-table";
import { DataColumn } from "components/data-table/data-column";
import { SearchInput } from "components/search-input/search-input";
import { ArvadosTheme } from "common/custom-theme";
import { MultiselectToolbar } from "components/multiselect-toolbar/MultiselectToolbar";
import { TCheckedList } from "components/data-table/data-table";
import { createTree } from "models/tree";
import { DataTableFilters } from "components/data-table-filters/data-table-filters";
import { CloseIcon, IconType, MaximizeIcon, UnMaximizeIcon, MoreVerticalIcon } from "components/icon/icon";
import { PaperProps } from "@mui/material/Paper";
import { MPVPanelProps } from "components/multi-panel-view/multi-panel-view";
import classNames from "classnames";
import { InlinePulser } from "components/loading/inline-pulser";

type CssRules =
    | 'titleWrapper'
    | 'searchResultsTitleWrapper'
    | 'msToolbarStyles'
    | 'searchBox'
    | 'headerMenu'
    | 'toolbar'
    | 'footer'
    | 'loadMoreContainer'
    | 'numResults'
    | 'root'
    | 'moreOptionsButton'
    | 'title'
    | 'dataTable'
    | 'container'
    | 'paginationLabel'
    | 'paginationRoot'
    | "subToolbarWrapper"
    | 'runsToolbarWrapper'
    | 'searchResultsToolbar'
    | 'progressWrapper'
    | 'progressWrapperNoTitle';

const styles: CustomStyleRulesCallback<CssRules> = (theme: ArvadosTheme) => ({
    titleWrapper: {
        display: "flex",
        justifyContent: "space-between",
        marginTop: "5px",
        marginBottom: "-5px",
    },
    searchResultsTitleWrapper: {
        display: "flex",
        justifyContent: "space-between",
        marginTop: "5px",
        height: "30px",
    },
    msToolbarStyles: {
        marginLeft: "-5px",
    },
    subToolbarWrapper: {
        marginTop: "5px",
        marginLeft: "-15px",
    },
    runsToolbarWrapper: {
        marginTop: "5px",
        marginLeft: "-15px",
    },
    searchResultsToolbar: {
        marginTop: "10px",
        marginBottom: "auto",
    },
    searchBox: {
        paddingBottom: 0,
    },
    toolbar: {
        paddingTop: 0,
        paddingRight: theme.spacing(1),
        paddingLeft: "10px",
    },
    footer: {
        overflow: "auto",
    },
    loadMoreContainer: {
        minWidth: '8rem',
    },
    root: {
        height: "100%",
        flex: 1,
        overflowY: "auto",
    },
    moreOptionsButton: {
        padding: 0,
    },
    numResults: {
        marginTop: 0,
        fontSize: "10px",
        marginLeft: "10px",
        marginBottom: '-0.5rem',
        minWidth: '8.5rem',
    },
    title: {
        display: "inline-block",
        paddingLeft: theme.spacing(2),
        paddingTop: theme.spacing(2),
        fontSize: "18px",
        flexGrow: 1,
        paddingRight: "10px",
    },
    progressWrapper: {
        margin: "14px 0 0",
        paddingLeft: "20px",
        paddingRight: "20px",
    },
    progressWrapperNoTitle: {
        marginTop: '12px',
    },
    dataTable: {
        height: "100%",
        overflowY: "auto",
    },
    container: {
        height: "100%",
    },
    headerMenu: {
        marginLeft: "auto",
        flexBasis: "initial",
        flexGrow: 0,
    },
    paginationLabel: {
        margin: 0,
        padding: 0,
        fontSize: '0.75rem',
    },
    paginationRoot: {
        fontSize: '0.75rem',
        color: theme.palette.grey["600"],
    },
});

interface DataExplorerDataProps<T extends DataTableItem> {
    fetchMode: DataTableFetchMode;
    items: string[];
    resourceItems: T[];
    itemsAvailable: number;
    loadingItemsAvailable: boolean;
    columns: DataColumns<T>;
    searchLabel?: string;
    searchValue: string;
    rowsPerPage: number;
    rowsPerPageOptions: number[];
    page: number;
    contextMenuColumn: boolean;
    defaultViewIcon?: IconType;
    defaultViewMessages?: string[];
    working?: boolean;
    hideColumnSelector?: boolean;
    paperProps?: PaperProps;
    actions?: React.ReactNode;
    hideSearchInput?: boolean;
    title?: React.ReactNode;
    progressBar?: React.ReactNode;
    path?: string;
    currentRouteUuid: string;
    selectedResourceUuid: string;
    elementPath?: string;
    isMSToolbarVisible: boolean;
    checkedList: TCheckedList;
    isNotFound: boolean;
    searchBarValue: string;
    paperClassName?: string;
    forceMultiSelectMode?: boolean;
    detailsPanelResourceUuid: string;
}

interface DataExplorerActionProps<T> {
    onSetColumns: (columns: DataColumns<T>) => void;
    onSearch: (value: string) => void;
    onRowClick: (item: T) => void;
    onRowDoubleClick: (item: T) => void;
    onColumnToggle: (column: DataColumn<T>) => void;
    onContextMenu: (event: React.MouseEvent<HTMLElement>, item: T) => void;
    onSortToggle: (column: DataColumn<T>) => void;
    onFiltersChange: (filters: DataTableFilters, column: DataColumn<T>) => void;
    onPageChange: (page: number) => void;
    onChangeRowsPerPage: (rowsPerPage: number) => void;
    onLoadMore: (page: number) => void;
    extractKey?: (item: T) => React.Key;
    toggleMSToolbar: (isVisible: boolean) => void;
    setCheckedListOnStore: (checkedList: TCheckedList) => void;
    setSelectedUuid: (uuid: string) => void;
    usesDetailsCard: (uuid: string) => boolean;
    loadDetailsPanel: (uuid: string) => void;
}

type DataExplorerProps<T extends DataTableItem> = DataExplorerDataProps<T> & DataExplorerActionProps<T> & WithStyles<CssRules> & MPVPanelProps;

export const DataExplorer = withStyles(styles)(
    class DataExplorerGeneric<T extends DataTableItem> extends React.Component<DataExplorerProps<T>> {
        state = {
            hideToolbar: true,
            isSearchResults: false,
        };

        multiSelectToolbarInTitle = !this.props.title && !this.props.progressBar;
        maxItemsAvailable = 0;

        componentDidMount() {
            if (this.props.onSetColumns) {
                this.props.onSetColumns(this.props.columns);
            }
            this.setState({ isSearchResults: this.props.path?.includes("search-results") ? true : false })
        }

        componentDidUpdate( prevProps: Readonly<DataExplorerProps<T>>, prevState: Readonly<{}>, snapshot?: any ): void {
            const { selectedResourceUuid, currentRouteUuid, path, usesDetailsCard } = this.props;
            if(selectedResourceUuid !== prevProps.selectedResourceUuid || currentRouteUuid !== prevProps.currentRouteUuid) {
                this.setState({
                    hideToolbar: usesDetailsCard(path || '') ? selectedResourceUuid === this.props.currentRouteUuid : false,
                })
            }
            if (this.props.itemsAvailable !== prevProps.itemsAvailable) {
                this.maxItemsAvailable = Math.max(this.maxItemsAvailable, this.props.itemsAvailable);
            }
            if (this.props.searchBarValue !== prevProps.searchBarValue) {
                this.maxItemsAvailable = 0;
            }
            if (this.props.path !== prevProps.path) {
                this.setState({ isSearchResults: this.props.path?.includes("search-results") ? true : false })
            }
        }

        render() {
            const {
                columns,
                onContextMenu,
                onFiltersChange,
                onSortToggle,
                extractKey,
                rowsPerPage,
                rowsPerPageOptions,
                onColumnToggle,
                searchLabel,
                searchValue,
                onSearch,
                items,
                itemsAvailable,
                loadingItemsAvailable,
                onRowClick,
                onRowDoubleClick,
                classes,
                defaultViewIcon,
                defaultViewMessages,
                hideColumnSelector,
                actions,
                paperProps,
                hideSearchInput,
                path,
                fetchMode,
                selectedResourceUuid,
                title,
                progressBar,
                doHidePanel,
                doMaximizePanel,
                doUnMaximizePanel,
                panelName,
                panelMaximized,
                elementPath,
                toggleMSToolbar,
                setCheckedListOnStore,
                checkedList,
                working,
                paperClassName,
                forceMultiSelectMode,
                detailsPanelResourceUuid,
                loadDetailsPanel,
                resourceItems,
            } = this.props;
            return (
                <Paper
                    className={classNames(classes.root, paperClassName)}
                    {...paperProps}
                    key={path}
                    data-cy={this.props["data-cy"]}
                    >
                    <Grid
                        container
                        direction="column"
                        wrap="nowrap"
                        className={classes.container}
                >
                    {title && this.state.isSearchResults && (
                        <Grid
                            item
                            xs
                            className={classes.title}
                        >
                            {title}

                        </Grid>
                    )}

                <div data-cy="title-wrapper" className={classNames(this.state.isSearchResults ? classes.searchResultsTitleWrapper : classes.titleWrapper)}>
                    {title && !this.state.isSearchResults && (
                        <Grid
                            item
                            xs
                            className={classes.title}
                        >
                            {title}

                        </Grid>
                    )}
                    {!this.state.hideToolbar && (this.multiSelectToolbarInTitle
                                               ? <MultiselectToolbar injectedStyles={classes.msToolbarStyles} />
                                               : <MultiselectToolbar
                                                     forceMultiSelectMode={forceMultiSelectMode}
                                                     injectedStyles={classNames(panelName === 'Subprocesses' ? classes.subToolbarWrapper : panelName === 'Runs' ? classes.runsToolbarWrapper : '')}/>)
                    }
                    {(!hideColumnSelector || !hideSearchInput || !!actions) && (
                        <Grid
                            className={classes.headerMenu}
                            item
                            xs
                        >
                            <Toolbar className={classes.toolbar}>
                                <Grid container justifyContent="space-between" wrap="nowrap" alignItems="center">
                                    {!hideSearchInput && (
                                        <div className={classes.searchBox}>
                                            {!hideSearchInput && (
                                                <SearchInput
                                                    label={searchLabel}
                                                    value={searchValue}
                                                    selfClearProp={""}
                                                    onSearch={onSearch}
                                                />
                                            )}
                                        </div>
                                    )}
                                    {actions}
                                    {!hideColumnSelector && (
                                        <ColumnSelector
                                            columns={columns}
                                            onColumnToggle={onColumnToggle}
                                        />
                                    )}
                                </Grid>
                                {doUnMaximizePanel && panelMaximized && (
                                    <Tooltip
                                        title={`Unmaximize ${panelName || "panel"}`}
                                        disableFocusListener
                                    >
                                        <IconButton onClick={doUnMaximizePanel} size="large">
                                            <UnMaximizeIcon />
                                        </IconButton>
                                    </Tooltip>
                                )}
                                {doMaximizePanel && !panelMaximized && (
                                    <Tooltip
                                        title={`Maximize ${panelName || "panel"}`}
                                        disableFocusListener
                                    >
                                        <IconButton onClick={doMaximizePanel} size="large">
                                            <MaximizeIcon />
                                        </IconButton>
                                    </Tooltip>
                                )}
                                {doHidePanel && (
                                    <Tooltip
                                        title={`Close ${panelName || "panel"}`}
                                        disableFocusListener
                                    >
                                        <IconButton disabled={panelMaximized} onClick={doHidePanel} size="large">
                                            <CloseIcon />
                                        </IconButton>
                                    </Tooltip>
                                )}
                            </Toolbar>
                        </Grid>
                    )}

                </div>
                <Grid
                    item
                    className={classes.dataTable}
                >
                    {!!progressBar &&
                     <div className={classNames({
                         [classes.progressWrapper]: true,
                         [classes.progressWrapperNoTitle]: !title,
                     })}>{progressBar}</div>
                    }
                    <DataTable
                        columns={this.props.contextMenuColumn ? [...columns, this.contextMenuColumn] : columns}
                        items={resourceItems}
                        onRowClick={(_, item: T) => onRowClick(item)}
                        onContextMenu={onContextMenu}
                        onRowDoubleClick={(_, item: T) => onRowDoubleClick(item)}
                        onFiltersChange={onFiltersChange}
                        onSortToggle={onSortToggle}
                        extractKey={extractKey}
                        defaultViewIcon={defaultViewIcon}
                        defaultViewMessages={defaultViewMessages}
                        currentRoute={path}
                        toggleMSToolbar={toggleMSToolbar}
                        setCheckedListOnStore={setCheckedListOnStore}
                        checkedList={checkedList}
                        selectedResourceUuid={selectedResourceUuid}
                        setSelectedUuid={this.props.setSelectedUuid}
                        currentRouteUuid={this.props.currentRouteUuid}
                        working={working}
                        isNotFound={this.props.isNotFound}
                        detailsPanelResourceUuid={detailsPanelResourceUuid}
                        loadDetailsPanel={loadDetailsPanel}
                    />
                </Grid>
                <Grid
                item
                xs
                >
                <Toolbar className={classes.footer}>
                {elementPath && (
                    <Grid container>
                        <span data-cy="element-path">{elementPath.length > 2 ? elementPath : ''}</span>
                    </Grid>
                )}
                <Grid
                container={!elementPath}
                                    justifyContent="flex-end"
                                >
                                    {fetchMode === DataTableFetchMode.PAGINATED ? (
                                        <TablePagination
                                        data-cy="table-pagination"
                                            count={itemsAvailable}
                                            rowsPerPage={rowsPerPage}
                                            rowsPerPageOptions={rowsPerPageOptions}
                                            page={this.props.page}
                                            onPageChange={this.changePage}
                                            onRowsPerPageChange={this.changeRowsPerPage}
                                            labelDisplayedRows={renderPaginationLabel(loadingItemsAvailable)}
                                            nextIconButtonProps={getPaginiationButtonProps(itemsAvailable, loadingItemsAvailable)}
                                            component="div"
                                            classes={{
                                                root: classes.paginationRoot,
                                                selectLabel: classes.paginationLabel,
                                                displayedRows: classes.paginationLabel,
                                            }}
                                        />
                                    ) : (
                                        <Grid className={classes.loadMoreContainer}>
                                            <Typography  className={classes.numResults}>
                                                Showing {items.length} / {this.maxItemsAvailable} results
                                            </Typography>
                                            <Button
                                                size="small"
                                                onClick={this.loadMore}
                                                variant="contained"
                                                color="primary"
                                                style={{width: '100%', margin: '10px'}}
                                                disabled={working || items.length >= itemsAvailable}
                                            >
                                                Load more
                                            </Button>
                                        </Grid>
                                    )}
                                </Grid>
                            </Toolbar>
                        </Grid>
                    </Grid>
                </Paper>
            );
        }

        changePage = (event: React.MouseEvent<HTMLButtonElement>, page: number) => {
            this.props.onPageChange(page);
        };

        changeRowsPerPage: React.ChangeEventHandler<HTMLTextAreaElement | HTMLInputElement> = event => {
            this.props.onChangeRowsPerPage(parseInt(event.target.value, 10));
        };

        loadMore = () => {
            this.props.onLoadMore(this.props.page + 1);
        };

        renderContextMenuTrigger = (item: T) => (
            <Grid
                container
                justifyContent="center"
            >
                <Tooltip
                    title="More options"
                    disableFocusListener
                >
                    <IconButton
                        className={this.props.classes.moreOptionsButton}
                        onClick={event => {
                            event.stopPropagation()
                            this.props.onContextMenu(event, item)
                        }}
                        size="large">
                        <MoreVerticalIcon />
                    </IconButton>
                </Tooltip>
            </Grid>
        );

        contextMenuColumn: DataColumn<T> = {
            name: "Actions",
            selected: true,
            configurable: false,
            filters: createTree(),
            key: "context-actions",
            render: this.renderContextMenuTrigger,
        };
    }
);

const renderPaginationLabel = (loading: boolean) => ({ from, to, count }) => (
    loading ?
        <InlinePulser/>
        : <>{from}-{to} of {count}</>
);

const getPaginiationButtonProps = (itemsAvailable: number, loading: boolean) => (
    loading
        ? { disabled: false } // Always allow paging while loading total
        : itemsAvailable > 0
            ? { }
            : { disabled: true } // Disable next button on empty lists since that's not default behavior
);
