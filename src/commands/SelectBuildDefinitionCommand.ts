import {VstsBuildRestClient} from "../vstsbuildrestclient";
import {Settings} from "../settings";
import {BuildQuickPicker} from "../components/BuildQuickPicker";
import {validateSettings, handleError} from "./Decorators";

export default class SelectBuildDefinitionCommand {
    private buildQuickPicker: BuildQuickPicker;

    constructor(private settings: Settings, private restClient: VstsBuildRestClient) {
        this.buildQuickPicker = new BuildQuickPicker(settings, restClient);
    }

    @validateSettings
    @handleError
    public execute(): Promise<any> {
        return this.buildQuickPicker.showBuildDefinitionQuickPick("Select a build definition to monitor")
            .then(result => {
                if (result) {
                    this.settings.activeBuildDefinitions = result;
                }
            })
    }
}