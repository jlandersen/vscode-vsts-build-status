import * as assert from "assert";
import * as sinon from "sinon";
import {window} from "vscode";
import {StatusMonitor} from "../src/StatusMonitor";
import {Settings, WorkspaceVstsSettings} from "../src/Settings";
import {VstsRestClientImpl} from "../src/VstsRestClient";
import {StatusBar} from "../src/components/StatusBar";

describe("StatusMonitor", () => {
    describe("#updateStatus", () => {
        let sandbox = sinon.sandbox.create();

        afterEach(() => {
            sandbox.restore();
        })

        it("Hides status bar if no valid settings", done => {
            let settingsStub = sinon.createStubInstance(WorkspaceVstsSettings);
            settingsStub.isValid.returns(false);
            let restClientStub = sinon.createStubInstance(VstsRestClientImpl);
            let statusBarSpy = sandbox.spy(StatusBar.prototype, "hideStatusBarItem");
            let sut = new StatusMonitor(settingsStub, restClientStub);

            sut.updateStatus();

            assert.ok(statusBarSpy.calledOnce, "the status bar should be hidden when settings are not provided");
            done();
            sut.dispose();
        });

        it("Shows helper message when no selected build definition", done => {
            let settingsStub = sinon.createStubInstance(WorkspaceVstsSettings);
            settingsStub.isValid.returns(true);
            let restClientStub = sinon.createStubInstance(VstsRestClientImpl);
            let statusBarSpy = sandbox.spy(StatusBar.prototype, "displayInformation");
            let sut = new StatusMonitor(settingsStub, restClientStub);

            sut.updateStatus();

            assert.ok(statusBarSpy.calledWithMatch(
                sinon.match((val: string) => val.indexOf("Select a single build definition") > -1)), 
                "the status bar should show helper information when no definition is selected");
            done();
            sut.dispose();
        });

        it("Calls getBuilds when definition is selected", done => {
            let settingsStub = sinon.createStubInstance(WorkspaceVstsSettings);
            settingsStub.isValid.returns(true);
            sinon.stub(settingsStub, "activeBuildDefinitions").get(() => [{}]);
            let clientStub = {
                getBuilds: sinon.stub().resolves([])
            }
            let sut = new StatusMonitor(settingsStub, <any>clientStub);
            
            sut.updateStatus();
            
            assert.ok(clientStub.getBuilds.calledOnce);
            done();
            sut.dispose();
        });

        it("Shows build in progress when latest build is running", done => {
            let settingsStub = sinon.createStubInstance(WorkspaceVstsSettings);
            settingsStub.isValid.returns(true);
            let statusBarSpy = sandbox.spy(StatusBar.prototype, "displayLoading");
            sinon.stub(settingsStub, "activeBuildDefinitions").get(() => [{}]);
            let clientStub = {
                getBuilds: sinon.stub().resolves({
                    value: [
                        {
                            // The build has no result yet
                        }
                    ]
                })
            };
            let sut = new StatusMonitor(settingsStub, <any>clientStub);
            
            sut.updateStatus().then(_ => {
                assert.ok(statusBarSpy.calledOnce, "the status bar should display loading");
                done();
                sut.dispose();
            });
        });

        it("Shows build failed when latest build result is not succeeded", done => {
            let settingsStub = sinon.createStubInstance(WorkspaceVstsSettings);
            settingsStub.isValid.returns(true);
            let statusBarSpy = sandbox.spy(StatusBar.prototype, "displayError");
            sinon.stub(settingsStub, "activeBuildDefinitions").get(() => [{}]);
            let clientStub = {
                getBuilds: sinon.stub().resolves({
                    value: [
                        {
                            result: "error"
                        }
                    ]
                })
            };
            let sut = new StatusMonitor(settingsStub, <any>clientStub);
            
            sut.updateStatus().then(_ => {
                assert.ok(statusBarSpy.calledOnce, "the status bar should display error when build failed");
                done();
                sut.dispose();
            });
        });

        it("Shows build successful when latest build succeeded", done => {
            let settingsStub = sinon.createStubInstance(WorkspaceVstsSettings);
            settingsStub.isValid.returns(true);
            let statusBarSpy = sandbox.spy(StatusBar.prototype, "displaySuccess");
            sinon.stub(settingsStub, "activeBuildDefinitions").get(() => [{}]);
            let clientStub = {
                getBuilds: sinon.stub().resolves({
                    value: [
                        {
                            result: "succeeded"
                        }
                    ]
                })
            };
            let sut = new StatusMonitor(settingsStub, <any>clientStub);
            
            sut.updateStatus().then(_ => {
                assert.ok(statusBarSpy.calledOnce, "the status bar should display success when build succeeded");
                done();
                sut.dispose();
            });
        });

        it("Shows connection error message when first fetch fails", done => {
            let settingsStub = sinon.createStubInstance(WorkspaceVstsSettings);
            settingsStub.isValid.returns(true);
            let statusBarSpy = sandbox.spy(StatusBar.prototype, "displayConnecting");
            let windowSpy = sandbox.spy(window, "showErrorMessage");
            sinon.stub(settingsStub, "activeBuildDefinitions").get(() => [{}]);
            let clientStub = {
                getBuilds: sinon.stub().rejects({})
            };

            let sut = new StatusMonitor(settingsStub, <any>clientStub);
            
            sut.updateStatus()
                .then(_ => {
                    return sut.updateStatus();
                })
                .then(_ => {
                    assert.ok(statusBarSpy.calledTwice, "the status bar should display connecting status");
                    assert.ok(windowSpy.calledOnce, "error message should be displayed once");
                    done();
                    sut.dispose();                
                });
        });

        it("Shows retrying connection when fetch builds fails", done => {
            let settingsStub = sinon.createStubInstance(WorkspaceVstsSettings);
            settingsStub.isValid.returns(true);
            let statusBarSpy = sandbox.spy(StatusBar.prototype, "displayConnecting");
            sinon.stub(settingsStub, "activeBuildDefinitions").get(() => [{}]);
            let clientStub = {
                getBuilds: sinon.stub().rejects({})
            };

            let sut = new StatusMonitor(settingsStub, <any>clientStub);
            
            sut.updateStatus().then(_ => {
                assert.ok(statusBarSpy.calledOnce, "the status bar should display connecting status");
                done();
                sut.dispose();
            });
        });
    });
});