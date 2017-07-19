import {window} from "vscode";
import {VstsRestClient} from "../VstsRestClient";
import {Settings} from "../Settings";
import {BuildQuickPicker} from "../components/BuildQuickPicker";
import {BuildLogViewer} from "../components/BuildLogViewer";
import {validateSettings, handleError} from "./Decorators";

export default class OpenBuildLogCommand {
    private buildQuickPicker: BuildQuickPicker;
    private logViewer: BuildLogViewer;

    constructor(private settings: Settings, private restClient: VstsRestClient) {
        this.buildQuickPicker = new BuildQuickPicker(settings, restClient);
        this.logViewer = new BuildLogViewer(restClient);
    }

    @validateSettings
    @handleError
    public execute(): Promise<any> {
        return this.buildQuickPicker.showBuildDefinitionQuickPick("Select a build definition")
            .then(result => {
                if (!result) {
                    return;
                }

                if (result.length > 1) {
                    window.showInformationMessage(`Viewing group build is not possible, please select single build instead.`);
                    return;
                }

                return this.buildQuickPicker.showBuildQuickPick(result[0].id, "Select a build to view");
            })
            .then(build => {
                if (!build) {
                    return;
                }

                this.logViewer.viewLog(build.id);
            });
    }

    public dispose() {
        if (this.logViewer) {
            this.logViewer.dispose;
        }
    }
}