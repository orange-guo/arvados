// Copyright (C) The Arvados Authors. All rights reserved.
//
// SPDX-License-Identifier: AGPL-3.0

import React from 'react';
import {
    Input as MuiInput,
    Chip as MuiChip,
    Popper as MuiPopper,
    Paper as MuiPaper,
    FormControl, InputLabel, StyleRulesCallback, withStyles, RootRef, ListItemText, ListItem, List, FormHelperText, Tooltip, Typography, Tabs, Tab
} from '@material-ui/core';
import { PopperProps } from '@material-ui/core/Popper';
import { WithStyles } from '@material-ui/core/styles';
import { noop } from 'lodash';
import { isGroup } from 'common/isGroup';
import { sortByKey } from 'common/objects';
import { TabbedList } from 'components/tabbedList/tabbed-list';

export interface AutocompleteProps<Item, Suggestion> {
    label?: string;
    value: string;
    items: Item[];
    disabled?: boolean;
    suggestions?: Suggestion[];
    error?: boolean;
    helperText?: string;
    autofocus?: boolean;
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
    onBlur?: (event: React.FocusEvent<HTMLInputElement>) => void;
    onFocus?: (event: React.FocusEvent<HTMLInputElement>) => void;
    onCreate?: () => void;
    onDelete?: (item: Item, index: number) => void;
    onSelect?: (suggestion: Suggestion) => void;
    renderChipValue?: (item: Item) => string;
    renderChipTooltip?: (item: Item) => string;
    renderSuggestion?: (suggestion: Suggestion) => React.ReactNode;
    category?: AutocompleteCat;
}

type AutocompleteClasses = 'sharingList' | 'emptyList' | 'listSubHeader' | 'numFound' | 'tabbedListStyles';

const autocompleteStyles: StyleRulesCallback<AutocompleteClasses> = theme => ({
    sharingList: {
        maxHeight: '10rem', 
        overflowY: 'scroll',
        scrollbarColor: 'rgba(0, 0, 0, 0.3) rgba(0, 0, 0, 0)',
        '&::-webkit-scrollbar': {
            width: '0.4em',
        },
        '&::-webkit-scrollbar-thumb': {
            backgroundColor: 'rgba(0, 0, 0, 0.3)',
            borderRadius: '4px',
        },
        '&::-webkit-scrollbar-track': {
            backgroundColor: 'rgba(0, 0, 0, 0)',
        },
    },
    emptyList: {
        padding: '0.5rem',
        fontStyle: 'italic',
    },
    listSubHeader: {
        padding: '0.5rem',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
    },
    numFound: {
        fontStyle: 'italic',
        fontSize: '0.8rem',
    },
    tabbedListStyles: {
        maxHeight: '18rem',
    }
});

export enum AutocompleteCat {
    SHARING = 'sharing',
};

export interface AutocompleteState {
    suggestionsOpen: boolean;
    selectedSuggestionIndex: number;
    keypress: { key: string };
}

export const Autocomplete = withStyles(autocompleteStyles)(
    class Autocomplete<Value, Suggestion> extends React.Component<AutocompleteProps<Value, Suggestion> & WithStyles<AutocompleteClasses>, AutocompleteState> {

    state = {
        suggestionsOpen: false,
        selectedSuggestionIndex: 0,
        keypress: { key: '' }
    };

    containerRef = React.createRef<HTMLDivElement>();
    inputRef = React.createRef<HTMLInputElement>();

    render() {
        return (
            <RootRef rootRef={this.containerRef}>
                <FormControl fullWidth error={this.props.error}>
                    {this.renderLabel()}
                    {this.renderInput()}
                    {this.renderHelperText()}
                    {this.props.category === AutocompleteCat.SHARING ? this.renderTabbedSuggestions() : this.renderSuggestions()}
                    {/* {this.props.category === AutocompleteCat.SHARING ? this.renderSharingSuggestions() : this.renderSuggestions()} */}
                </FormControl>
            </RootRef>
        );
    }

    renderLabel() {
        const { label } = this.props;
        return label && <InputLabel>{label}</InputLabel>;
    }

    renderInput() {
        return <Input
            disabled={this.props.disabled}
            autoFocus={this.props.autofocus}
            inputRef={this.inputRef}
            value={this.props.value}
            startAdornment={this.renderChips()}
            onFocus={this.handleFocus}
            onBlur={this.handleBlur}
            onChange={this.props.onChange}
            onKeyPress={this.handleKeyPress}
            onKeyDown={this.handleNavigationKeyPress}
        />;
    }

    renderHelperText() {
        return <FormHelperText>{this.props.helperText}</FormHelperText>;
    }

    renderSuggestions() {
        const { suggestions = [] } = this.props;
        return (
            <Popper
                open={this.isSuggestionBoxOpen()}
                anchorEl={this.inputRef.current}
                key={suggestions.length}>
                <Paper onMouseDown={this.preventBlur}>
                    <List dense style={{ width: this.getSuggestionsWidth() }}>
                        {suggestions.map(
                            (suggestion, index) =>
                                <ListItem
                                    button
                                    key={index}
                                    onClick={this.handleSelect(suggestion)}
                                    selected={index === this.state.selectedSuggestionIndex}>
                                    {this.renderSuggestion(suggestion)}
                                </ListItem>
                        )}
                    </List>
                </Paper>
            </Popper>
        );
    }

    renderSharingSuggestions() {
        const { suggestions = [], classes } = this.props;
        const users = sortByKey<Suggestion>(suggestions.filter(item => !isGroup(item)), 'fullName');
        const groups = sortByKey<Suggestion>(suggestions.filter(item => isGroup(item)), 'name');

        return (
            <Popper
                open={this.isSuggestionBoxOpen()}
                anchorEl={this.inputRef.current}
                key={suggestions.length}>
                <Paper onMouseDown={this.preventBlur}>
                    <div className={classes.listSubHeader}>
                        Groups {<span className={classes.numFound}>{groups.length} {groups.length === 1 ? 'match' : 'matches'} found</span>}
                    </div>
                    <List dense className={classes.sharingList} style={{width: this.getSuggestionsWidth()}}>
                        {groups.map(
                            (suggestion, index) =>
                                <ListItem
                                    button
                                    id={`groups-${index}`}
                                    key={`groups-${index}`}
                                    onClick={this.handleSelect(suggestion)}>
                                    {this.renderSharingSuggestion(suggestion)}
                                </ListItem>
                        )}
                    </List> 
                    <div className={classes.listSubHeader}>
                        Users {<span className={classes.numFound}>{users.length} {users.length === 1 ? 'match' : 'matches'} found</span>}
                    </div>
                    <List dense className={classes.sharingList} style={{width: this.getSuggestionsWidth()}}>
                        {users.map(
                            (suggestion, index) =>
                                <ListItem
                                    button
                                    id={`users-${index}`}
                                    key={`users-${index}`}
                                    onClick={this.handleSelect(suggestion)}>
                                    {this.renderSharingSuggestion(suggestion)}
                                </ListItem>
                        )}
                    </List> 
                </Paper>
            </Popper>
        );
    }

    renderTabbedSuggestions() {
        const { suggestions = [], classes } = this.props;
        const users = sortByKey<Suggestion>(suggestions.filter(item => !isGroup(item)), 'fullName');
        const groups = sortByKey<Suggestion>(suggestions.filter(item => isGroup(item)), 'name');

        const parsedSugggestions = [{label: 'Groups', items: groups}, {label: 'Users', items: users}];
        
        return (
            <Popper
                open={this.isSuggestionBoxOpen()}
                anchorEl={this.inputRef.current}
                key={suggestions.length}
                style={{ width: this.getSuggestionsWidth()}}
            >
                <Paper onMouseDown={this.preventBlur}>
                    <TabbedList 
                        tabbedListContents={parsedSugggestions} 
                        renderListItem={this.renderSharingSuggestion} 
                        injectedStyles={classes.tabbedListStyles}
                        selectedIndex={this.state.selectedSuggestionIndex}
                        keypress={this.state.keypress}
                        />
                </Paper>
            </Popper>
        );
    }

    isSuggestionBoxOpen() {
        const { suggestions = [] } = this.props;
        return this.state.suggestionsOpen && suggestions.length > 0;
    }

    handleFocus = (event: React.FocusEvent<HTMLInputElement>) => {
        const { onFocus = noop } = this.props;
        this.setState({ suggestionsOpen: true });
        onFocus(event);
    }

    handleBlur = (event: React.FocusEvent<HTMLInputElement>) => {
        setTimeout(() => {
            const { onBlur = noop } = this.props;
            this.setState({ suggestionsOpen: false });
            onBlur(event);
        });
    }

    handleKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
        const { onCreate = noop, onSelect = noop, suggestions = [] } = this.props;
        const { selectedSuggestionIndex } = this.state;
        if (event.key === 'Enter') {
            if (this.isSuggestionBoxOpen() && selectedSuggestionIndex < suggestions.length) {
                // prevent form submissions when selecting a suggestion
                event.preventDefault();
                onSelect(suggestions[selectedSuggestionIndex]);
            } else if (this.props.value.length > 0) {
                onCreate();
            }
        }
    }

    handleNavigationKeyPress = (ev: React.KeyboardEvent<HTMLInputElement>) => {
        this.setState({ keypress: { key: ev.key } });
        if (ev.key === 'Tab' && this.isSuggestionBoxOpen()) {
            ev.preventDefault();
        }
        if (ev.key === 'ArrowUp') {
            this.updateSelectedSuggestionIndex(-1);
        } else if (ev.key === 'ArrowDown') {
            this.updateSelectedSuggestionIndex(1);
        }
    }

    updateSelectedSuggestionIndex(value: -1 | 1) {
        const { suggestions = [] } = this.props;
        this.setState(({ selectedSuggestionIndex }) => ({
            selectedSuggestionIndex: (selectedSuggestionIndex + value) % suggestions.length
        }));
    }

    renderChips() {
        const { items, onDelete } = this.props;

        /**
         * If input startAdornment prop is not undefined, input's label will stay above the input.
         * If there is not items, we want the label to go back to placeholder position.
         * That why we return without a value instead of returning a result of a _map_ which is an empty array.
         */
        if (items.length === 0) {
            return;
        }

        return items.map(
            (item, index) => {
                const tooltip = this.props.renderChipTooltip ? this.props.renderChipTooltip(item) : '';
                if (tooltip && tooltip.length) {
                    return <span key={index}>
                        <Tooltip title={tooltip}>
                        <Chip
                            label={this.renderChipValue(item)}
                            key={index}
                            onDelete={onDelete && !this.props.disabled ? (() =>  onDelete(item, index)) : undefined} />
                    </Tooltip></span>
                } else {
                    return <span key={index}><Chip
                        label={this.renderChipValue(item)}
                        onDelete={onDelete && !this.props.disabled ? (() =>  onDelete(item, index)) : undefined} /></span>
                }
            }
        );
    }

    renderChipValue(value: Value) {
        const { renderChipValue } = this.props;
        return renderChipValue ? renderChipValue(value) : JSON.stringify(value);
    }

    preventBlur = (event: React.MouseEvent<HTMLElement>) => {
        event.preventDefault();
    }

    handleClickAway = (event: React.MouseEvent<HTMLElement>) => {
        if (event.target !== this.inputRef.current) {
            this.setState({ suggestionsOpen: false });
        }
    }

    handleSelect(suggestion: Suggestion) {
        return () => {
            const { onSelect = noop } = this.props;
            const { current } = this.inputRef;
            if (current) {
                current.focus();
            }
            onSelect(suggestion);
        };
    }

    renderSuggestion(suggestion: Suggestion) {
        const { renderSuggestion } = this.props;
        return renderSuggestion
            ? renderSuggestion(suggestion)
            : <ListItemText>{JSON.stringify(suggestion)}</ListItemText>;
    }

    renderSharingSuggestion(suggestion: Suggestion) {
        if (isGroup(suggestion)) {
            return <ListItemText>
                        <Typography noWrap data-cy="sharing-suggestion">
                            {(suggestion as any).name}
                        </Typography>
                    </ListItemText>;}
        return <ListItemText>
                    <Typography data-cy="sharing-suggestion">
                        {`${(suggestion as any).fullName} (${(suggestion as any).username})`}
                    </Typography>
                </ListItemText>;
    }

    getSuggestionsWidth() {
        return this.containerRef.current ? this.containerRef.current.offsetWidth : 'auto';
    }
});

type ChipClasses = 'root';

const chipStyles: StyleRulesCallback<ChipClasses> = theme => ({
    root: {
        marginRight: theme.spacing.unit / 4,
        height: theme.spacing.unit * 3,
    }
});

const Chip = withStyles(chipStyles)(MuiChip);

type PopperClasses = 'root';

const popperStyles: StyleRulesCallback<PopperClasses> = theme => ({
    root: {
        zIndex: theme.zIndex.modal,
    }
});

const Popper = withStyles(popperStyles)(
    ({ classes, ...props }: PopperProps & WithStyles<PopperClasses>) =>
        <MuiPopper {...props} className={classes.root} />
);

type InputClasses = 'root';

const inputStyles: StyleRulesCallback<InputClasses> = () => ({
    root: {
        display: 'flex',
        flexWrap: 'wrap',
    },
    input: {
        minWidth: '20%',
        flex: 1,
    },
});

const Input = withStyles(inputStyles)(MuiInput);

const Paper = withStyles({
    root: {
        maxHeight: '80vh',
        overflowY: 'auto',
    }
})(MuiPaper);
