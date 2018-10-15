// Copyright (C) The Arvados Authors. All rights reserved.
//
// SPDX-License-Identifier: AGPL-3.0

import { unionize, ofType, UnionOf } from "~/common/unionize";
import { GroupContentsResource, GroupContentsResourcePrefix } from '~/services/groups-service/groups-service';
import { Dispatch } from 'redux';
import { change, arrayPush } from 'redux-form';
import { RootState } from '~/store/store';
import { initUserProject } from '~/store/tree-picker/tree-picker-actions';
import { ServiceRepository } from '~/services/services';
import { FilterBuilder } from "~/services/api/filter-builder";
import { ResourceKind } from '~/models/resource';
import { GroupClass } from '~/models/group';
import { SearchBarAdvanceFormData, PropertyValues } from '~/models/search-bar';

export const searchBarActions = unionize({
    SET_CURRENT_VIEW: ofType<string>(),
    OPEN_SEARCH_VIEW: ofType<{}>(),
    CLOSE_SEARCH_VIEW: ofType<{}>(),
    SET_SEARCH_RESULTS: ofType<GroupContentsResource[]>(),
    SET_SEARCH_VALUE: ofType<string>(),
    SET_SAVED_QUERIES: ofType<string[]>()
});

export type SearchBarActions = UnionOf<typeof searchBarActions>;

export const SEARCH_BAR_ADVANCE_FORM_NAME = 'searchBarAdvanceFormName';

export const SEARCH_BAR_ADVANCE_FORM_PICKER_ID = 'searchBarAdvanceFormPickerId';

export const goToView = (currentView: string) => searchBarActions.SET_CURRENT_VIEW(currentView);

export const saveRecentQuery = (query: string) =>
    (dispatch: Dispatch<any>, getState: () => RootState, services: ServiceRepository) =>
        services.searchService.saveRecentQuery(query);


export const loadRecentQueries = () =>
    (dispatch: Dispatch<any>, getState: () => RootState, services: ServiceRepository) => {
        const recentSearchQueries = services.searchService.getRecentQueries();
        return recentSearchQueries || [];
    };

export const saveQuery = (data: SearchBarAdvanceFormData) =>
    (dispatch: Dispatch<any>, getState: () => RootState, services: ServiceRepository) => {
        if (data.saveQuery && data.searchQuery) {
            services.searchService.saveQuery(data.searchQuery);
            dispatch(searchBarActions.SET_SAVED_QUERIES(services.searchService.getSavedQueries()));
        }
    };

export const deleteSavedQuery = (id: number) =>
    (dispatch: Dispatch<any>, getState: () => RootState, services: ServiceRepository) => {
        services.searchService.deleteSavedQuery(id);
        const savedSearchQueries = services.searchService.getSavedQueries();
        dispatch(searchBarActions.SET_SAVED_QUERIES(savedSearchQueries));
        return savedSearchQueries || [];
    };

export const openSearchView = () =>
    (dispatch: Dispatch<any>, getState: () => RootState, services: ServiceRepository) => {
        dispatch(searchBarActions.OPEN_SEARCH_VIEW());
        const savedSearchQueries = services.searchService.getSavedQueries();
        dispatch(searchBarActions.SET_SAVED_QUERIES(savedSearchQueries));
    };

export const closeSearchView = () => 
    (dispatch: Dispatch<any>, getState: () => RootState, services: ServiceRepository) => {
        const isOpen = getState().searchBar.open;
        if(isOpen) {
            dispatch(searchBarActions.CLOSE_SEARCH_VIEW());
        }
    };

export const searchData = (searchValue: string) =>
    async (dispatch: Dispatch, getState: () => RootState, services: ServiceRepository) => {
        dispatch(searchBarActions.SET_SEARCH_VALUE(searchValue));
        dispatch(searchBarActions.SET_SEARCH_RESULTS([]));
        if (searchValue) {
            const filters = getFilters('name', searchValue);
            const { items } = await services.groupsService.contents('', {
                filters,
                limit: 5,
                recursive: true
            });
            dispatch(searchBarActions.SET_SEARCH_RESULTS(items));
        }
    };

const getFilters = (filterName: string, searchValue: string): string => {
    return new FilterBuilder()
        .addIsA("uuid", [ResourceKind.PROJECT, ResourceKind.COLLECTION, ResourceKind.PROCESS])
        .addILike(filterName, searchValue, GroupContentsResourcePrefix.COLLECTION)
        .addILike(filterName, searchValue, GroupContentsResourcePrefix.PROCESS)
        .addILike(filterName, searchValue, GroupContentsResourcePrefix.PROJECT)
        .addEqual('groupClass', GroupClass.PROJECT, GroupContentsResourcePrefix.PROJECT)
        .getFilters();
};

export const initAdvanceFormProjectsTree = () => 
    async (dispatch: Dispatch, getState: () => RootState, services: ServiceRepository) => {
        dispatch<any>(initUserProject(SEARCH_BAR_ADVANCE_FORM_PICKER_ID));
    };

export const changeAdvanceFormProperty = (property: string, value: PropertyValues[] | string = '') => 
    async (dispatch: Dispatch, getState: () => RootState, services: ServiceRepository) => {
        dispatch(change(SEARCH_BAR_ADVANCE_FORM_NAME, property, value));
    };

export const updateAdvanceFormProperties = (propertyValues: PropertyValues) => 
    async (dispatch: Dispatch, getState: () => RootState, services: ServiceRepository) => {
        dispatch(arrayPush(SEARCH_BAR_ADVANCE_FORM_NAME, 'properties', propertyValues));
    };