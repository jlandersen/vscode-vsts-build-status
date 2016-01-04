## Visual Studio Team Services Build Extension for Visual Studio Code
Check the status of your Visual Studio Team Services builds directly in Visual Studio Code!
Select a build definition to monitor, and a status indicator will be visible in the status bar.

![Screenshot-1](assets/vscode-selection.png)
![Screenshot-2](assets/vscode-status.png)

The status bar icon will become visible when the necessary settings are provided (see Configuration).
A selected build definition in a specific workspace will be selected automatically the next time you open that workspace.

## Configuration
The extension is enabled by providing the following settings (user or workspace):

```json
{
    "vsts.password": "mypersonalaccesstoken",
    "vsts.account": "myaccount",
    "vsts.project": "myproject"
}
```

## License
MIT, please see LICENSE for details. Copyright (c) 2016 Jeppe Andersen.