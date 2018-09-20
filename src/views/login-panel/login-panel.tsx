// Copyright (C) The Arvados Authors. All rights reserved.
//
// SPDX-License-Identifier: AGPL-3.0

import * as React from 'react';
import { compose } from 'redux';
import { connect, DispatchProp } from 'react-redux';
import { Grid, Typography, Button } from '@material-ui/core';
import { StyleRulesCallback, WithStyles, withStyles } from '@material-ui/core/styles';
import { login } from '~/store/auth/auth-action';
import { ArvadosTheme } from '~/common/custom-theme';
import * as classNames from 'classnames';

type CssRules = 'root' | 'container' | 'title' | 'content' | 'content__bolder' | 'button';

const styles: StyleRulesCallback<CssRules> = (theme: ArvadosTheme) => ({
    root: {
        background: theme.palette.background.default
    },
    container: {
        width: '560px'
    },
    title: {
        marginBottom: theme.spacing.unit * 6,
        color: theme.palette.grey["800"]
    },
    content: {
        marginBottom: theme.spacing.unit * 3,
        lineHeight: '1.2rem',
        color: theme.palette.grey["800"]
    },
    'content__bolder': {
        fontWeight: 'bolder'
    },
    button: {
        boxShadow: 'none'
    }
});

type LoginPanelProps = DispatchProp<any> & WithStyles<CssRules>;

export const LoginPanel = compose(
    withStyles(styles),
    connect()
)(({ classes, dispatch }: LoginPanelProps) => 
    <Grid container direction="column" item xs alignItems="center" justify="center" className={classes.root}>
        <Grid item className={classes.container}>
            <Typography variant="title" align="center" className={classes.title}>
                Welcome to the Arvados Wrokbench
            </Typography>
            <Typography variant="body1" className={classes.content}>
                The "Log in" button below will show you a Google sign-in page.
                After you assure Google that you want to log in here with your Google account,
                you will be redirected back here to Arvados Workbench.
            </Typography>
            <Typography variant="body1" className={classes.content}>
                If you have never used Arvados Workbench before, logging in for the first time will automatically create a new account.
            </Typography>
            <Typography variant="body2" className={classNames(classes.content, classes.content__bolder)}>
                IMPORTANT: Please keep in mind to store exploratory data only but not any information used for clinical decision making.
            </Typography>
            <Typography variant="body1" className={classes.content}>
                Arvados Workbench uses your name and email address only for identification, and does not retrieve any other personal information from Google.
            </Typography>
            <Typography component="div" align="right">
                <Button variant="contained" color="primary" className={classes.button} onClick={() => dispatch(login())}>
                    Log in
                </Button>
            </Typography>
        </Grid>
    </Grid>
);