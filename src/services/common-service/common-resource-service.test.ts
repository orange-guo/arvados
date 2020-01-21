// Copyright (C) The Arvados Authors. All rights reserved.
//
// SPDX-License-Identifier: AGPL-3.0

import { CommonResourceService } from "./common-resource-service";
import axios, { AxiosInstance } from "axios";
import MockAdapter from "axios-mock-adapter";
import { Resource } from "src/models/resource";
import { ApiActions } from "~/services/api/api-actions";

const actions: ApiActions = {
    progressFn: (id: string, working: boolean) => {},
    errorFn: (id: string, message: string) => {}
};

export const mockResourceService = <R extends Resource, C extends CommonResourceService<R>>(
    Service: new (client: AxiosInstance, actions: ApiActions) => C) => {
    const axiosInstance = axios.create();
    const axiosMock = new MockAdapter(axiosInstance);
    const service = new Service(axiosInstance, actions);
    Object.keys(service).map(key => service[key] = jest.fn());
    return service;
};

describe("CommonResourceService", () => {
    let axiosInstance: AxiosInstance;
    let axiosMock: MockAdapter;

    beforeEach(() => {
        axiosInstance = axios.create();
        axiosMock = new MockAdapter(axiosInstance);
    });

    it("#create", async () => {
        axiosMock
            .onPost("/resource")
            .reply(200, { owner_uuid: "ownerUuidValue" });

        const commonResourceService = new CommonResourceService(axiosInstance, "resource", actions);
        const resource = await commonResourceService.create({ ownerUuid: "ownerUuidValue" });
        expect(resource).toEqual({ ownerUuid: "ownerUuidValue" });
    });

    it("#create maps request params to snake case", async () => {
        axiosInstance.post = jest.fn(() => Promise.resolve({data: {}}));
        const commonResourceService = new CommonResourceService(axiosInstance, "resource", actions);
        await commonResourceService.create({ ownerUuid: "ownerUuidValue" });
        expect(axiosInstance.post).toHaveBeenCalledWith("/resource", {owner_uuid: "ownerUuidValue"});
    });

    it("#delete", async () => {
        axiosMock
            .onDelete("/resource/uuid")
            .reply(200, { deleted_at: "now" });

        const commonResourceService = new CommonResourceService(axiosInstance, "resource", actions);
        const resource = await commonResourceService.delete("uuid");
        expect(resource).toEqual({ deletedAt: "now" });
    });

    it("#get", async () => {
        axiosMock
            .onGet("/resource/uuid")
            .reply(200, {
                modified_at: "now",
                properties: {
                    responsible_owner_uuid: "another_owner"
                }
            });

        const commonResourceService = new CommonResourceService(axiosInstance, "resource", actions);
        const resource = await commonResourceService.get("uuid");
        // Only first level keys are mapped to camel case
        expect(resource).toEqual({
            modifiedAt: "now",
            properties: {
                responsible_owner_uuid: "another_owner"
            }
        });
    });

    it("#list", async () => {
        axiosMock
            .onGet("/resource")
            .reply(200, {
                kind: "kind",
                offset: 2,
                limit: 10,
                items: [{
                    modified_at: "now",
                    properties: {
                        is_active: true
                    }
                }],
                items_available: 20
            });

        const commonResourceService = new CommonResourceService(axiosInstance, "resource", actions);
        const resource = await commonResourceService.list({ limit: 10, offset: 1 });
        // First level keys are mapped to camel case inside "items" arrays
        expect(resource).toEqual({
            kind: "kind",
            offset: 2,
            limit: 10,
            items: [{
                modifiedAt: "now",
                properties: {
                    is_active: true
                }
            }],
            itemsAvailable: 20
        });
    });

    it("#list using POST when query string is too big", async () => {
        axiosMock
            .onAny("/resource")
            .reply(200);
        const tooBig = 'x'.repeat(1500);
        const commonResourceService = new CommonResourceService(axiosInstance, "resource", actions);
        await commonResourceService.list({ filters: tooBig });
        expect(axiosMock.history.get.length).toBe(0);
        expect(axiosMock.history.post.length).toBe(1);
        expect(axiosMock.history.post[0].data.get('filters')).toBe(`[${tooBig}]`);
        expect(axiosMock.history.post[0].params._method).toBe('GET');
    });

    it("#list using GET when query string is not too big", async () => {
        axiosMock
            .onAny("/resource")
            .reply(200);
        const notTooBig = 'x'.repeat(1480);
        const commonResourceService = new CommonResourceService(axiosInstance, "resource", actions);
        await commonResourceService.list({ filters: notTooBig });
        expect(axiosMock.history.post.length).toBe(0);
        expect(axiosMock.history.get.length).toBe(1);
        expect(axiosMock.history.get[0].params.filters).toBe(`[${notTooBig}]`);
    });
});
