import {window} from "vscode";
import {getDefaultSettings} from "../settings";

function errorHandler(error: any) {
    if (!error) {
        return;
    }

   window.showInformationMessage("Account, project and password/Personal Access Token must be provided in user or workspace settings.");
}

export function handleError(target: Object, propertyKey: string, descriptor: TypedPropertyDescriptor<any>) {
    const originalMethod = descriptor.value;

    descriptor.value = function (...args: any[]) {
        let result = <Promise<any>>originalMethod.apply(this, args);
        result = result.catch(errorHandler);

        return result;
    };

    return descriptor;
}

export function validateSettings(target: Object, propertyKey: string, descriptor: TypedPropertyDescriptor<any>) {
    const originalMethod = descriptor.value;

    descriptor.value = function (...args: any[]) {
        if (!getDefaultSettings().isValid()) {
            window.showInformationMessage("Account, project and password/Personal Access Token must be provided in user or workspace settings.");
            return;
        }

        let result = originalMethod.apply(this, args);

        return result;
    };

    return descriptor;
}