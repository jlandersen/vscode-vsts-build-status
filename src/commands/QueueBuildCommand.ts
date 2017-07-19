import {window} from "vscode";
import {VstsRestClient, isHttpResponseError} from "../VstsRestClient";
import {Settings} from "../Settings";
import {BuildQuickPicker} from "../components/BuildQuickPicker";
import {validateSettings, handleError} from "./Decorators";

export default class QueueBuildCommand {
    private buildQuickPicker: BuildQuickPicker;
    constructor(private settings: Settings, private restClient: VstsRestClient) {
        this.buildQuickPicker = new BuildQuickPicker(settings, restClient);
    }

    @validateSettings
    @handleError
    public execute(): Promise<any> {
        let getBuildDefinition = this.buildQuickPicker.showBuildDefinitionQuickPick("Select a build definition");
        let getBranch = getBuildDefinition.then(_ => {
            return window.showInputBox({ prompt: "Branch (leave empty to use default) ?" });
        });

        return Promise.all([getBuildDefinition, getBranch])
            .then(result => {
                let selectedBuildDefinition = result[0];
                let selectedBranch = result[1];

                if (!selectedBuildDefinition) {
                    return;
                }

                if (selectedBuildDefinition.length > 1) {
                    window.showInformationMessage(`Queueing group build is not possible, please queue single builds one-by-one instead.`);
                    return;
                }

                if (selectedBranch === undefined) {
                    return;
                }

                return this.restClient.queueBuild(selectedBuildDefinition[0].id, selectedBranch);
            })
            .then(result => {
                if (!result) {
                    // User cancelled
                    return;
                }

                window.showInformationMessage(`Build has been queued for ${result.value.definition.name}`);
            })
            .catch(error => {
                if (!isHttpResponseError(error) || error.isUnauthorizedError()) {
                    return Promise.reject(error);
                }

                window.showErrorMessage(`Unable to queue build (status code ${error.statusCode}): ${error.errorMessage}`);
            });
    }
}