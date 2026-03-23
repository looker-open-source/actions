import * as chai from "chai"
import * as sinon from "sinon"

import {WebClient} from "@slack/web-api"
import * as Hub from "../../hub"
import * as _SlackClientManager from "./slack_client_manager"
import {PLACEHOLDER_WORKSPACE, SlackClientManager} from "./slack_client_manager"
import {MULTI_WORKSPACE_SUPPORTED_VERSION} from "./slack_client_manager"

describe("SlackClientManager", () => {
    let stubClient: any

    afterEach(() => {
        stubClient && stubClient.restore()
    })

    describe("empty state_json", () => {
        const request = new Hub.ActionRequest()

        const clientManager = new SlackClientManager(request)

        it("hasAnyClients works", () => {
            chai.expect(clientManager.hasAnyClients()).to.eq(false)
        })
        it("getClients works", () => {
            chai.expect(clientManager.getClients()).to.empty
        })
        it("hasSelectedClient works", () => {
            chai.expect(clientManager.hasSelectedClient()).to.eq(false)
        })
        it("getSelectedClient works", () => {
            chai.expect(clientManager.getSelectedClient()).to.eq(undefined)
        })
        it("getClient works", () => {
            chai.expect(clientManager.getClient("abc")).to.eq(undefined)
        })
    })

    describe("< supported multi workspace version", () => {
        const request = new Hub.ActionRequest()
        request.params.state_json = "some token"

        it("hasAnyClients works", () => {
            const mockClient = new WebClient()
            stubClient = sinon.stub(_SlackClientManager, "makeSlackClient").returns(mockClient)
            const clientManager = new SlackClientManager(request)
            chai.expect(clientManager.hasAnyClients()).to.equals(true)
        })
        it("getClients works", () => {
            const mockClient = new WebClient()
            stubClient = sinon.stub(_SlackClientManager, "makeSlackClient").returns(mockClient)
            const clientManager = new SlackClientManager(request)
            const result = clientManager.getClients()
            chai.expect(result).to.deep.equals([mockClient])
        })
        it("hasSelectedClient works", () => {
            const mockClient = new WebClient()
            stubClient = sinon.stub(_SlackClientManager, "makeSlackClient").returns(mockClient)
            const clientManager = new SlackClientManager(request)
            chai.expect(clientManager.hasSelectedClient()).to.eq(true)
        })
        it("getSelectedClient works", () => {
            const mockClient = new WebClient()
            stubClient = sinon.stub(_SlackClientManager, "makeSlackClient").returns(mockClient)
            const clientManager = new SlackClientManager(request)
            chai.expect(clientManager.getSelectedClient()).to.equal(mockClient)
        })
        it("getClient works", () => {
            const mockClient = new WebClient()
            stubClient = sinon.stub(_SlackClientManager, "makeSlackClient").returns(mockClient)
            const clientManager = new SlackClientManager(request)
            chai.expect(clientManager.getClient(PLACEHOLDER_WORKSPACE)).to.equal(mockClient)
        })
    })

    describe("> supported multi workspace version", () => {
        describe("no token", () => {
            const request = new Hub.ActionRequest()
            request.lookerVersion = MULTI_WORKSPACE_SUPPORTED_VERSION
            request.params.state_json = JSON.stringify([])

            it("hasAnyClients works", () => {
                const clientManager = new SlackClientManager(request)
                chai.expect(clientManager.hasAnyClients()).to.equals(false)
            })
            it("getClients works", () => {
                const clientManager = new SlackClientManager(request)
                const result = clientManager.getClients()
                chai.expect(result).to.be.empty
            })
            it("hasSelectedClient works", () => {
                const clientManager = new SlackClientManager(request)
                chai.expect(clientManager.hasSelectedClient()).to.eq(false)
            })
            it("getSelectedClient works", () => {
                const clientManager = new SlackClientManager(request)
                chai.expect(clientManager.getSelectedClient()).to.eq(undefined)
            })
            it("getClient works", () => {
                const clientManager = new SlackClientManager(request)
                chai.expect(clientManager.getClient("WS1")).to.eq(undefined)
            })
        })

        describe("has fault tolerance for json str state json", () => {
            const request = new Hub.ActionRequest()
            request.lookerVersion = MULTI_WORKSPACE_SUPPORTED_VERSION
            request.params.state_json = JSON.stringify("token1")

            it("hasAnyClients works", () => {
                const mockClient = new WebClient()
                stubClient = sinon.stub(_SlackClientManager, "makeSlackClient").returns(mockClient)
                const clientManager = new SlackClientManager(request)
                chai.expect(clientManager.hasAnyClients()).to.equals(true)
            })
            it("getClients works", () => {
                const mockClient = new WebClient()
                stubClient = sinon.stub(_SlackClientManager, "makeSlackClient").returns(mockClient)
                const clientManager = new SlackClientManager(request)
                const result = clientManager.getClients()
                chai.expect(result).to.deep.equals([mockClient])
            })
            it("hasSelectedClient works", () => {
                const mockClient = new WebClient()
                stubClient = sinon.stub(_SlackClientManager, "makeSlackClient").returns(mockClient)
                const clientManager = new SlackClientManager(request)
                chai.expect(clientManager.hasSelectedClient()).to.eq(true)
            })
            it("getSelectedClient works", () => {
                const mockClient = new WebClient()
                stubClient = sinon.stub(_SlackClientManager, "makeSlackClient").returns(mockClient)
                const clientManager = new SlackClientManager(request)
                chai.expect(clientManager.getSelectedClient()).to.equal(mockClient)
            })
            it("getClient works", () => {
                const mockClient = new WebClient()
                stubClient = sinon.stub(_SlackClientManager, "makeSlackClient").returns(mockClient)
                const clientManager = new SlackClientManager(request)
                chai.expect(clientManager.getClient("WS1")).to.equals(undefined)
                chai.expect(clientManager.getClient(PLACEHOLDER_WORKSPACE)).to.equal(mockClient)
            })
        })

        describe("has fault tolerance for str state json", () => {
            const request = new Hub.ActionRequest()
            request.lookerVersion = MULTI_WORKSPACE_SUPPORTED_VERSION
            request.params.state_json = "token1"

            it("hasAnyClients works", () => {
                const mockClient = new WebClient()
                stubClient = sinon.stub(_SlackClientManager, "makeSlackClient").returns(mockClient)
                const clientManager = new SlackClientManager(request)
                chai.expect(clientManager.hasAnyClients()).to.equals(true)
            })
            it("getClients works", () => {
                const mockClient = new WebClient()
                stubClient = sinon.stub(_SlackClientManager, "makeSlackClient").returns(mockClient)
                const clientManager = new SlackClientManager(request)
                const result = clientManager.getClients()
                chai.expect(result).to.deep.equals([mockClient])
            })
            it("hasSelectedClient works", () => {
                const mockClient = new WebClient()
                stubClient = sinon.stub(_SlackClientManager, "makeSlackClient").returns(mockClient)
                const clientManager = new SlackClientManager(request)
                chai.expect(clientManager.hasSelectedClient()).to.eq(true)
            })
            it("getSelectedClient works", () => {
                const mockClient = new WebClient()
                stubClient = sinon.stub(_SlackClientManager, "makeSlackClient").returns(mockClient)
                const clientManager = new SlackClientManager(request)
                chai.expect(clientManager.getSelectedClient()).to.equal(mockClient)
            })
            it("getClient works", () => {
                const mockClient = new WebClient()
                stubClient = sinon.stub(_SlackClientManager, "makeSlackClient").returns(mockClient)
                const clientManager = new SlackClientManager(request)
                chai.expect(clientManager.getClient("WS1")).to.equals(undefined)
                chai.expect(clientManager.getClient(PLACEHOLDER_WORKSPACE)).to.equal(mockClient)
            })
        })

        describe("one token - no selected ws", () => {
            const request = new Hub.ActionRequest()
            request.lookerVersion = MULTI_WORKSPACE_SUPPORTED_VERSION
            request.params.state_json = JSON.stringify([{install_id: "WS1", token: "token1"}])

            it("hasAnyClients works", () => {
                const mockClient = new WebClient()
                stubClient = sinon.stub(_SlackClientManager, "makeSlackClient").returns(mockClient)
                const clientManager = new SlackClientManager(request)
                chai.expect(clientManager.hasAnyClients()).to.equals(true)
            })
            it("getClients works", () => {
                const mockClient = new WebClient()
                stubClient = sinon.stub(_SlackClientManager, "makeSlackClient").returns(mockClient)
                const clientManager = new SlackClientManager(request)
                const result = clientManager.getClients()
                chai.expect(result).to.deep.equals([mockClient])
            })
            it("hasSelectedClient works", () => {
                const mockClient = new WebClient()
                stubClient = sinon.stub(_SlackClientManager, "makeSlackClient").returns(mockClient)
                const clientManager = new SlackClientManager(request)
                chai.expect(clientManager.hasSelectedClient()).to.eq(true)
            })
            it("getSelectedClient works", () => {
                const mockClient = new WebClient()
                stubClient = sinon.stub(_SlackClientManager, "makeSlackClient").returns(mockClient)
                const clientManager = new SlackClientManager(request)
                chai.expect(clientManager.getSelectedClient()).to.equal(mockClient)
            })
            it("getClient works", () => {
                const mockClient = new WebClient()
                stubClient = sinon.stub(_SlackClientManager, "makeSlackClient").returns(mockClient)
                const clientManager = new SlackClientManager(request)
                chai.expect(clientManager.getClient("WS1")).to.equal(mockClient)
            })
        })

        describe("multiple tokens", () => {
            const request = new Hub.ActionRequest()
            request.lookerVersion = MULTI_WORKSPACE_SUPPORTED_VERSION
            request.params.state_json = JSON.stringify([
                {install_id: "WS1", token: "token1"},
                {install_id: "WS2", token: "token2"},
            ])

            it("hasAnyClients works", () => {
                const mockClient = new WebClient()
                stubClient = sinon.stub(_SlackClientManager, "makeSlackClient").returns(mockClient)
                const clientManager = new SlackClientManager(request)
                chai.expect(clientManager.hasAnyClients()).to.equals(true)
            })
            it("getClients works", () => {
                const mockClient1 = new WebClient()
                const mockClient2 = new WebClient()
                stubClient = sinon.stub(_SlackClientManager, "makeSlackClient")
                    .callsFake((token) => {
                        if (token === "token1") return mockClient1
                        if (token === "token2") return mockClient2
                        return new WebClient()
                    })
                const clientManager = new SlackClientManager(request)
                const result = clientManager.getClients()
                chai.expect(result).to.deep.equal([mockClient1, mockClient2])
            })
            it("hasSelectedClient works", () => {
                const mockClient = new WebClient()
                stubClient = sinon.stub(_SlackClientManager, "makeSlackClient").returns(mockClient)
                const clientManager = new SlackClientManager(request)
                chai.expect(clientManager.hasSelectedClient()).to.eq(true)
            })

            it("hasSelectedClient works - with selected WS", () => {
                const mockClient = new WebClient()
                stubClient = sinon.stub(_SlackClientManager, "makeSlackClient").returns(mockClient)
                const hasSelecteWSReq = Object.assign({}, request, { formParams: { workspace: "WS1"}})
                const clientManager = new SlackClientManager(hasSelecteWSReq)
                chai.expect(clientManager.hasSelectedClient()).to.eq(true)
            })

            it("getSelectedClient works", () => {
                const mockClient1 = new WebClient()
                stubClient = sinon.stub(_SlackClientManager, "makeSlackClient").callsFake((token) => {
                    if (token === "token1") return mockClient1
                    return new WebClient()
                })
                const clientManager = new SlackClientManager(request)
                chai.expect(clientManager.getSelectedClient()).to.equal(mockClient1)
            })
            it("getSelectedClient works - with selected WS", () => {
                const mockClient2 = new WebClient()
                stubClient = sinon.stub(_SlackClientManager, "makeSlackClient").callsFake((token) => {
                    if (token === "token2") return mockClient2
                    return new WebClient()
                })
                const hasSelecteWSReq = Object.assign({}, request, { formParams: { workspace: "WS2"}})
                const clientManager = new SlackClientManager(hasSelecteWSReq)
                chai.expect(clientManager.getSelectedClient()).to.equal(mockClient2)
            })
            it("getClient works", () => {
                const mockClient1 = new WebClient()
                const mockClient2 = new WebClient()
                stubClient = sinon.stub(_SlackClientManager, "makeSlackClient").callsFake((token) => {
                    if (token === "token1") return mockClient1
                    if (token === "token2") return mockClient2
                    return new WebClient()
                })
                const clientManager = new SlackClientManager(request)
                chai.expect(clientManager.getClient("WS1")).to.equal(mockClient1)
                chai.expect(clientManager.getClient("WS2")).to.equal(mockClient2)
                chai.expect(clientManager.getClient("WS3")).to.eq(undefined)
            })
        })
    })
})
