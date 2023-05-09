// Copyright (C) The Arvados Authors. All rights reserved.
//
// SPDX-License-Identifier: AGPL-3.0

import React, { useEffect } from 'react';
import { WithStyles, withStyles, ButtonBase, StyleRulesCallback, Theme, Popover, Button, Card, CardActions, Tooltip, IconButton } from '@material-ui/core';
import classnames from 'classnames';
import { DefaultTransformOrigin } from 'components/popover/helpers';
import debounce from 'lodash/debounce';
import { grey } from '@material-ui/core/colors';

export type CssRules = 'root' | 'icon' | 'iconButton' | 'optionsContainer' | 'option';

const styles: StyleRulesCallback<CssRules> = (theme: Theme) => ({
    root: {
        borderRadius: '7px',
        '&:hover': {
            backgroundColor: grey[200],
        },
        '&:focus': {
            color: theme.palette.text.primary,
        },
    },
    icon: {
        cursor: 'pointer',
        fontSize: 20,
        userSelect: 'none',
        '&:hover': {
            color: theme.palette.text.primary,
        },
        paddingBottom: '5px',
    },
    iconButton: {
        color: theme.palette.text.primary,
        opacity: 0.6,
        padding: 1,
        paddingBottom: 5,
    },
    optionsContainer: {
        paddingTop: '1rem',
        flex: 1,
    },
    option: {
        cursor: 'pointer',
        display: 'flex',
        padding: '3px 2rem',
        fontSize: '0.9rem',
        alignItems: 'center',
        '&:hover': {
            backgroundColor: 'rgba(0, 0, 0, 0.08)',
        },
    },
});

export type DataTableMultiselectOption = {
    name: string;
    fn: (checkedList) => void;
};

export interface DataTableMultiselectProps {
    name: string;
    options: DataTableMultiselectOption[];
    checkedList: Record<string, boolean>;
}

interface DataTableFMultiselectPopState {
    anchorEl?: HTMLElement;
}

export const DataTableMultiselectPopover = withStyles(styles)(
    class extends React.Component<DataTableMultiselectProps & WithStyles<CssRules>, DataTableFMultiselectPopState> {
        state: DataTableFMultiselectPopState = {
            anchorEl: undefined,
        };
        icon = React.createRef<HTMLElement>();

        render() {
            const { classes, children, options, checkedList } = this.props;
            return (
                <>
                    <Tooltip disableFocusListener title='Select Options'>
                        <ButtonBase className={classnames(classes.root)} component='span' onClick={this.open} disableRipple>
                            {children}
                            <IconButton component='span' classes={{ root: classes.iconButton }} tabIndex={-1}>
                                <i className={classnames(['fas fa-sort-down', classes.icon])} data-fa-transform='shrink-3' ref={this.icon} />
                            </IconButton>
                        </ButtonBase>
                    </Tooltip>
                    <Popover
                        anchorEl={this.state.anchorEl}
                        open={!!this.state.anchorEl}
                        anchorOrigin={DefaultTransformOrigin}
                        transformOrigin={DefaultTransformOrigin}
                        onClose={this.close}
                    >
                        <Card>
                            <div className={classes.optionsContainer}>
                                {options.length &&
                                    options.map((option, i) => (
                                        <div
                                            key={i}
                                            className={classes.option}
                                            onClick={() => {
                                                option.fn(checkedList);
                                                this.close();
                                            }}
                                        >
                                            {option.name}
                                        </div>
                                    ))}
                            </div>
                            <CardActions>
                                <Button color='primary' variant='outlined' size='small' onClick={this.close}>
                                    Close
                                </Button>
                            </CardActions>
                        </Card>
                    </Popover>
                    <this.MountHandler />
                </>
            );
        }

        open = () => {
            this.setState({ anchorEl: this.icon.current || undefined });
        };

        submit = debounce(() => {
            // const { onChange } = this.props;
            // if (onChange) {
            //     onChange(this.state.filters);
            // }
        }, 1000);

        MountHandler = () => {
            useEffect(() => {
                return () => {
                    this.submit.cancel();
                };
            }, []);
            return null;
        };

        close = () => {
            this.setState((prev) => ({
                ...prev,
                anchorEl: undefined,
            }));
        };
    }
);
