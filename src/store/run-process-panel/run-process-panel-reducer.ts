// Copyright (C) The Arvados Authors. All rights reserved.
//
// SPDX-License-Identifier: AGPL-3.0

import { RunProcessPanelAction, runProcessPanelActions } from '~/store/run-process-panel/run-process-panel-actions';
import { WorkflowResource, CommandInputParameter, getWorkflowInputs, parseWorkflowDefinition } from '~/models/workflow';

interface RunProcessPanel {
    currentStep: number;
    workflows: WorkflowResource[];
    selectedWorkflow: WorkflowResource | undefined;
    inputs: CommandInputParameter[];
}

const initialState: RunProcessPanel = {
    currentStep: 0,
    workflows: [],
    selectedWorkflow: undefined,
    inputs: [],
};

export const runProcessPanelReducer = (state = initialState, action: RunProcessPanelAction): RunProcessPanel =>
    runProcessPanelActions.match(action, {
        SET_CURRENT_STEP: currentStep => ({ ...state, currentStep }),
        SET_WORKFLOWS: workflows => ({ ...state, workflows }),
        SET_SELECTED_WORKFLOW: selectedWorkflow => ({
            ...state,
            selectedWorkflow,
            inputs: getWorkflowInputs(parseWorkflowDefinition(selectedWorkflow)) || [],
        }),
        default: () => state
    });