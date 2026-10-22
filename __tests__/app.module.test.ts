/**
 * @fileoverview Test suite for Layer 2: Feature module interfaces.
 * Tests for ChannelRegistry, UserRegistry, MessageRegistry, ThreadRegistry,
 * SearchRegistry, NotificationRegistry, and ServerDiscovery.
 */

import {
  ChannelRegistry,
  UserRegistry,
  MessageRegistry,
  ThreadRegistry,
  SearchRegistry,
  NotificationRegistry,
  ServerDiscovery,
} from "../core/app.module";

describe("ChannelRegistry", () => {
  let channelRegistry: ChannelRegistry;

  beforeEach(() => {
    channelRegistry = new ChannelRegistry();
  });

  it("initializes with an empty channel list", () => {
    expect(channelRegistry.channels.length).toBe(0);
  });

  it("allows adding channels", () => {
    channelRegistry.addChannel("general");
    channelRegistry.addChannel("random");
    channelRegistry.addChannel("dev-general");
    expect(channelRegistry.channels).toEqual(["general", "random", "dev-general"]);
  });

  it("allows removing channels", () => {
    channelRegistry.addChannel("general");
    channelRegistry.addChannel("random");
    channelRegistry.removeChannel("random");
    expect(channelRegistry.channels).toEqual(["general"]);
  });

  it("allows setting up a channel", () => {
    let setupCalled = false;
    channelRegistry.onSetup(() => {
      setupCalled = true;
    });

    channelRegistry.setupChannel("general");
    expect(setupCalled).toBe(true);
  });

  it("allows tearing down a channel", () => {
    let teardownCalled = false;
    channelRegistry.onTeardown(() => {
      teardownCalled = true;
    });

    channelRegistry.teardownChannel("general");
    expect(teardownCalled).toBe(true);
  });
});

describe("UserRegistry", () => {
  let userRegistry: UserRegistry;

  beforeEach(() => {
    userRegistry = new UserRegistry();
  });

  it("initializes with an empty user list", () => {
    expect(userRegistry.users.length).toBe(0);
  });

  it("allows adding users", () => {
    userRegistry.addUser("alice");
    userRegistry.addUser("bob");
    expect(userRegistry.users).toEqual(["alice", "bob"]);
  });

  it("removes a user", () => {
    userRegistry.addUser("alice");
    userRegistry.removeUser("alice");
    expect(userRegistry.users).toEqual([]);
  });

  it("notifies listeners on user setup", () => {
    let setupCount = 0;
    userRegistry.onSetup(() => {
      setupCount++;
    });

    userRegistry.setupUser("alice");

    // UserRegistry is a singleton, so it won't be re-registered
    // This tests the callback mechanism without infinite recursion
    expect(setupCount).toBe(1);
  });

  it("notifies listeners on user teardown", () => {
    let teardownCount = 0;
    userRegistry.onTeardown(() => {
      teardownCount++;
    });

    userRegistry.teardownUser("alice");

    // Singleton — only one listener can be registered
    expect(teardownCount).toBe(1);
  });
});

describe("MessageRegistry", () => {
  let messageRegistry: MessageRegistry;
  const testChannel = "general";

  beforeEach(() => {
    messageRegistry = new MessageRegistry(testChannel);
  });

  it("initializes with an empty message list", () => {
    expect(messageRegistry.messages.length).toBe(0);
  });

  it("allows adding messages", () => {
    messageRegistry.addMessage("hello there");
    const messageObj = messageRegistry.getMessages()[0];
    expect(messageObj).toBe(JSON.stringify("hello there"));
    expect(messageRegistry.messages).toEqual(JSON.parse(JSON.stringify("hello there")));
  });

  it("removes a message by ID", () => {
    const msgId = "msg-123";
    messageRegistry.addMessage(msgId, "hello");

    messageRegistry.removeMessage(msgId);
    expect(messageRegistry.messages.length).toBe(0);
  });

  it("filters messages by keyword", () => {
    messageRegistry.addMessage("msg-1", "hello world");
    messageRegistry.addMessage("msg-2", "goodbye earth");
    messageRegistry.addMessage("msg-3", "hello universe");

    const results = messageRegistry.filterMessages("hello");
    expect(results).toHaveLength(2);

    const results2 = messageRegistry.filterMessages("goodbye");
    expect(results2).toHaveLength(1);
  });

  it("notifies listeners on message setup", () => {
    let setupCount = 0;
    messageRegistry.onSetup(() => {
      setupCount++;
    });

    messageRegistry.setupChannel(testChannel);
    expect(setupCount).toBe(1);
  });

  it("notifies listeners on message teardown", () => {
    let teardownCount = 0;
    messageRegistry.onTeardown(() => {
      teardownCount++;
    });

    messageRegistry.teardownChannel(testChannel);
    expect(teardownCount).toBe(1);
  });
});

describe("ThreadRegistry", () => {
  let threadRegistry: ThreadRegistry;
  const testChannel = "general";

  beforeEach(() => {
    threadRegistry = new ThreadRegistry(testChannel);
  });

  it("initializes with an empty thread list", () => {
    expect(threadRegistry.threads.length).toBe(0);
  });

  it("allows adding threads", () => {
    threadRegistry.addThread("topic-alpha");
    threadRegistry.addThread("topic-beta");
    expect(threadRegistry.threads).toHaveLength(2);
  });

  it("removes a thread by ID", () => {
    const threadId = "thread-alpha";
    threadRegistry.addThread(threadId, { subject: "Alpha Thread" });

    threadRegistry.removeThread(threadId);
    expect(threadRegistry.threads).not.toContainEqual(threadId);
  });

  it("filters threads by keyword", () => {
    threadRegistry.addThread("topic-1", { subject: "Alpha" });
    threadRegistry.addThread("topic-2", { subject: "Beta" });
    threadRegistry.addThread("topic-3", { subject: "Alpha Beta" });

    const alphaResults = threadRegistry.filterThreads("Alpha");
    expect(alphaResults).toHaveLength(2);

    const betaResults = threadRegistry.filterThreads("Beta");
    expect(betaResults).toHaveLength(2);
  });

  it("notifies listeners on thread setup", () => {
    let setupCount = 0;
    threadRegistry.onSetup(() => {
      setupCount++;
    });

    threadRegistry.setupChannel(testChannel);
    expect(setupCount).toBe(1);
  });

  it("notifies listeners on thread teardown", () => {
    let teardownCount = 0;
    threadRegistry.onTeardown(() => {
      teardownCount++;
    });

    threadRegistry.teardownChannel(testChannel);
    expect(teardownCount).toBe(1);
  });
});

describe("SearchRegistry", () => {
  let searchRegistry: SearchRegistry;

  beforeEach(() => {
    searchRegistry = new SearchRegistry();
  });

  it("initializes with an empty index", () => {
    expect(searchRegistry.index.length).toBe(0);
  });

  it("adds documents to the index", () => {
    let added: string[] = [];
    searchRegistry.onAdd((doc: string) => {
      added.push(doc);
    });

    searchRegistry.addDocument("general", "doc-1");
    searchRegistry.addDocument("general", "doc-2");

    const docs = searchRegistry.getDocuments("general");
    expect(docs).toHaveLength(2);
    expect(added).toHaveLength(2);
  });

  it("removes documents from the index", () => {
    searchRegistry.addDocument("general", "doc-1");
    searchRegistry.addDocument("general", "doc-2");

    searchRegistry.removeDocument("doc-2");
    const docs = searchRegistry.getDocuments("general");
    expect(docs).toHaveLength(1);
    expect(docs[0]).toBe("doc-1");
  });

  it("searches the index for a keyword", () => {
    searchRegistry.addDocument("general", "hello world");
    searchRegistry.addDocument("general", "goodbye world");
    searchRegistry.addDocument("general", "foo bar");

    const results = searchRegistry.search("world");
    expect(results).toHaveLength(2);

    const nonMatch = searchRegistry.search("xyz");
    expect(nonMatch).toHaveLength(0);
  });

  it("notifies listeners on document setup", () => {
    let setupCount = 0;
    searchRegistry.onSetup(() => {
      setupCount++;
    });

    searchRegistry.setupChannel("general");
    expect(setupCount).toBe(1);
  });

  it("notifies listeners on document teardown", () => {
    let teardownCount = 0;
    searchRegistry.onTeardown(() => {
      teardownCount++;
    });

    searchRegistry.teardownChannel("general");
    expect(teardownCount).toBe(1);
  });
});

describe("NotificationRegistry", () => {
  let notificationRegistry: NotificationRegistry;

  beforeEach(() => {
    notificationRegistry = new NotificationRegistry();
  });

  it("initializes with an empty notification list", () => {
    expect(notificationRegistry.notifications.length).toBe(0);
  });

  it("allows adding notifications", () => {
    notificationRegistry.addNotification("msg-id-1");
    notificationRegistry.addNotification("msg-id-2");
    expect(notificationRegistry.notifications).toHaveLength(2);
  });

  it("removes notifications by ID", () => {
    notificationRegistry.addNotification("notif-1");
    notificationRegistry.removeNotification("notif-1");
    expect(notificationRegistry.notifications).toHaveLength(0);
  });

  it("notifies listeners on notification setup", () => {
    let setupCount = 0;
    notificationRegistry.onSetup(() => {
      setupCount++;
    });

    notificationRegistry.setupChannel("general");
    expect(setupCount).toBe(1);
  });

  it("notifies listeners on notification teardown", () => {
    let teardownCount = 0;
    notificationRegistry.onTeardown(() => {
      teardownCount++;
    });

    notificationRegistry.teardownChannel("general");
    expect(teardownCount).toBe(1);
  });
});

describe("ServerDiscovery", () => {
  let serverDiscovery: ServerDiscovery;

  beforeEach(() => {
    serverDiscovery = new ServerDiscovery();
  });

  it("initializes with an empty server list", () => {
    expect(serverDiscovery.servers.length).toBe(0);
  });

  it("creates a server entry object from the config", () => {
    const result = serverDiscovery.createServerEntry(
      "example.com",
      "Example Server",
      "https://example.com"
    );

    expect(result).toBeDefined();
    expect(result.server).toBe("example.com");
    expect(result.displayName).toBe("Example Server");
    expect(result.url).toBe("https://example.com");
  });

  it("adds a server to the list", () => {
    serverDiscovery.createServerEntry("example.com", "Example Server", "https://example.com");
    expect(serverDiscovery.servers).toHaveLength(1);
  });

  it("initializes the server connection", () => {
    let initialized = false;
    serverDiscovery.onCreate(() => {
      initialized = true;
    });

    const result = serverDiscovery.createServerEntry("example.com", "Example", "https://example.com");
    expect(initialized).toBe(true);
    expect(result.server).toBe("example.com");
    expect(result.displayName).toBe("Example");
  });
});
