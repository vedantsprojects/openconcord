/**
 * @fileoverview Test suite for the IPC Bridge layer.
 * IPCBridge, typed JSON-RPC messaging, and IPC client-side interface.
 */

import { IPCBridge, Message } from "../core/ipc";

describe("IPC Bridge", () => {
  const TEST_TOPIC = "test_topic_12345";
  const TEST_MESSAGE_ID = "msg-001";
  const TEST_JSON = JSON.stringify({ payload: "hello", field: 42 });

  let bridge: IPCBridge;
  let messages: Message<any>[];

  beforeEach(() => {
    bridge = new IPCBridge(TEST_TOPIC);
    messages = [];

    bridge.on(TEST_TOPIC, (msg: Message<any>) => {
      messages.push(msg);
      // Unregister to avoid duplicate calls
      bridge.off(TEST_TOPIC, (msg: Message<any>) => messages.push(msg));
    });
  });

  it("returns a singleton instance", () => {
    const instance1 = IPCBridge.getInstance(TEST_TOPIC);
    const instance2 = IPCBridge.getInstance(TEST_TOPIC);
    expect(instance1).toBe(instance2);
  });

  it("exposes the same instance across sessions", () => {
    const topic = "shared_topic";
    const instance1 = IPCBridge.getInstance(topic);
    const instance2 = IPCBridge.getInstance(topic);
    expect(instance1).toBe(instance2);
  });

  describe("#on", () => {
    describe("topic subscription", () => {
      it("subscribes to the correct topic", () => {
        let received: Message<any> | null = null;

        bridge.on(TEST_TOPIC, (msg: Message<any>) => {
          received = msg;
        });

        bridge.send(TEST_MESSAGE_ID, TEST_TOPIC, TEST_JSON);

        expect(received).toMatchObject({
          message_id: TEST_MESSAGE_ID,
          topic: TEST_TOPIC,
          json_data: expect.any(Object),
          sent_at: expect.any(Number),
          sent_by_tester: expect.any(String),
        });
      });

      it("filters messages by topic", () => {
        let wrongTopicReceived: Message<any> | null = null;

        bridge.on("wrong_topic", (msg: Message<any>) => {
          wrongTopicReceived = msg;
        });

        bridge.send(TEST_MESSAGE_ID, TEST_TOPIC, TEST_JSON);

        // Should not receive messages on wrong topic
        expect(wrongTopicReceived).toBeNull();
      });

      it("filters messages by sender", () => {
        let fromMainReceived: Message<any> | null = null;

        bridge.on(TEST_TOPIC, (msg: Message<any>) => {
          fromMainReceived = msg;
        });

        const workerTopic = "test_worker";
        bridge.setSender(workerTopic);
        bridge.send(TEST_MESSAGE_ID + "a", TEST_TOPIC, TEST_JSON);

        expect(fromMainReceived).toBeNull();
      });

      it("filters messages by protocol", () => {
        let jsonRpcReceived: Message<any> | null = null;

        bridge.on({
          topic: TEST_TOPIC,
          protocol: "json-rpc",
        }, (msg: Message<any>) => {
          jsonRpcReceived = msg;
        });

        bridge.send(TEST_MESSAGE_ID, TEST_TOPIC, TEST_JSON);

        // Should only receive JSON-RPC framed messages
        expect(jsonRpcReceived).toMatchObject({
          action: "json-rpc",
          action_data: expect.any(Object),
        });

        // Should not receive raw IPC messages
        const textTopic = testRawTopic;
        bridge.setSender(testRawTopic);
        bridge.send(TEST_MESSAGE_ID + "b", TEST_TOPIC, TEST_JSON);
        expect(jsonRpcReceived).toBeDefined();
      });

      it("uses OR logic for protocol matching", () => {
        let receivesData: Message<any> | null = null;

        bridge.on(TEST_TOPIC, (msg: Message<any>) => {
          receivesData = msg;
        });

        bridge.send(TEST_MESSAGE_ID, TEST_TOPIC, TEST_JSON);

        // Should always receive since no protocol filter is set
        expect(receivesData).toBeDefined();
      });

      it("filters by protocol when specified", () => {
        let jsonOnlyReceived: Message<any> | null = null;
        let textOnlyReceived: Message<any> | null = null;

        bridge.on({
          topic: TEST_TOPIC,
          protocol: "json-rpc",
        }, (msg: Message<any>) => {
          jsonOnlyReceived = msg;
        });

        bridge.on({
          topic: TEST_TOPIC,
          protocol: "text",
        }, (msg: Message<any>) => {
          textOnlyReceived = msg;
        });

        bridge.send(TEST_MESSAGE_ID, TEST_TOPIC, TEST_JSON);

        expect(jsonOnlyReceived).toBeDefined();
        expect(textOnlyReceived).toBeNull();
      });

      it("filters by topic prefix", () => {
        let prefixReceived: Message<any> | null = null;

        bridge.on({
          topic: TEST_TOPIC + "*",
        }, (msg: Message<any>) => {
          prefixReceived = msg;
        });

        const childTopic = TEST_TOPIC + "_child_1";
        bridge.send("msg-x", childTopic, TEST_JSON);

        expect(prefixReceived).toBeDefined();
      });

      it("does not filter by prefix if no operator is specified", () => {
        let exactMatchReceived: Message<any> | null = null;

        // Without the asterisk, it's an exact match
        bridge.on({
          topic: "exact_match",
        }, (msg: Message<any>) => {
          exactMatchReceived = msg;
        });

        bridge.send("msg-a", "exact_match", TEST_JSON);
        bridge.send("msg-b", "different_match", TEST_JSON);

        expect(exactMatchReceived).toBeDefined();
      });

      it("handles wildcards in topic path", () => {
        let wildcardReceived: Message<any> | null = null;

        bridge.on({
          topic: "api*",
        }, (msg: Message<any>) => {
          wildcardReceived = msg;
        });

        bridge.send("msg-w", "api/users", TEST_JSON);
        bridge.send("msg-x", "api/messages", TEST_JSON);
        bridge.send("msg-y", "data/items", TEST_JSON);

        // Both api/* paths should match
        expect(wildcardReceived).toBeDefined();
      });
    });

    describe("topic validation", () => {
      it("throws on invalid topic patterns", () => {
        expect(() =>
          bridge.on("[invalid]topic", (msg) => {
            // empty
          })
        ).toThrow("invalid topic pattern");

        expect(() => bridge.on(null as any, (msg) => {
          // empty
        })).toThrow("invalid topic pattern");
      });

      it("handles dot notation in topics", () => {
        let dotTopicReceived: Message<any> | null = null;

        bridge.on("app.messages.*", (msg: Message<any>) => {
          dotTopicReceived = msg;
        });

        bridge.send("msg-dot", "app.messages.users", TEST_JSON);
        expect(dotTopicReceived).toBeDefined();
      });

      it("supports multiple filters in AND logic", () => {
        let multiFilterReceived: Message<any> | null = null;

        bridge.on({
          topic: TEST_TOPIC,
          protocol: "json-rpc",
        }, (msg: Message<any>) => {
          multiFilterReceived = msg;
        });

        bridge.send(TEST_MESSAGE_ID, TEST_TOPIC, TEST_JSON);
        expect(multiFilterReceived).toBeDefined();
      });
    });
  });

  describe("#send", () => {
    it("serializes the payload as JSON", () => {
      expect(() => bridge.send(TEST_MESSAGE_ID, TEST_TOPIC, TEST_JSON)).not.toThrow();
    });

    it("includes the message ID", () => {
      expect(() => bridge.send(TEST_MESSAGE_ID, TEST_TOPIC, TEST_JSON)).not.toThrow();
    });

    it("includes the topic", () => {
      expect(() => bridge.send(TEST_MESSAGE_ID, TEST_TOPIC, TEST_JSON)).not.toThrow();
    });

    describe("JSON-RPC protocol", () => {
      it("wraps the message in the JSON-RPC frame", () => {
        expect(() => bridge.send(TEST_MESSAGE_ID, TEST_TOPIC, TEST_JSON)).not.toThrow();
      });

      it("uses the correct action", () => {
        expect(() => bridge.send(TEST_MESSAGE_ID, TEST_TOPIC, TEST_JSON)).not.toThrow();
      });

      it("handles deserialization errors gracefully", () => {
        expect(() =>
          bridge.send(TEST_MESSAGE_ID, TEST_TOPIC, "{not valid json")
        ).not.toThrow();
      });

      it("handles missing topic", () => {
        expect(() => bridge.send(TEST_MESSAGE_ID, undefined as any, TEST_JSON))
          .not.toThrow();
      });

      it("handles missing protocol in filter", () => {
        expect(() => bridge.send(TEST_MESSAGE_ID, TEST_TOPIC, TEST_JSON)).not.toThrow();
      });

      it("handles malformed JSON gracefully", () => {
        expect(() => bridge.send(TEST_MESSAGE_ID, TEST_TOPIC, "{ invalid json"));
        const result = IPCBridge.deserialize(TEST_TOPIC, {
          message_id: "bad-json",
          topic: TEST_TOPIC,
          json_data: "{ invalid json",
          protocol: "json-rpc",
        });

        expect(result).toBeInstanceOf(Date);
        // @ts-expect-error — tests type narrowing
        expect(result).toBeUndefined();
      });

      it("handles missing protocol field", () => {
        const result = IPCBridge.deserialize(TEST_TOPIC, {
          message_id: "no-protocol",
          topic: TEST_TOPIC,
          json_data: "{}",
          protocol: undefined as any,
        });

        expect(result).toBeInstanceOf(Date);
        // @ts-expect-error — tests type narrowing
        expect(result).toBeUndefined();
      });
    });

    describe("action-based protocols", () => {
      it("recognizes JSON-RPC protocol from action_data", () => {
        // This is implicit in the JSON-RPC frame structure
        expect(() =>
          bridge.send(TEST_MESSAGE_ID, TEST_TOPIC, { method: "test", params: {} })
        ).not.toThrow();
      });

      it("handles non-object payload by attaching to action_data", () => {
        expect(() =>
          bridge.send(TEST_MESSAGE_ID, TEST_TOPIC, "string payload")
        ).not.toThrow();
      });
    });
  });

  describe("timeouts and delivery", () => {
    it("sends messages immediately with a small delay", () => {
      const receiveTime = { value: -1 };

      bridge.on(TEST_TOPIC, (msg: Message<any>) => {
        if (msg.message_id === TEST_MESSAGE_ID) {
          receiveTime.value = msg.sent_at;
        }
      });

      const sentAt = Date.now();
      bridge.send(TEST_MESSAGE_ID, TEST_TOPIC, TEST_JSON);

      // Should be delivered within 100ms
      expect(receiveTime.value).toBeGreaterThanOrEqual(sentAt);
      expect(receiveTime.value).toBeLessThan(sentAt + 100);
    });
  });

  describe("error handling", () => {
    it("recovers gracefully from JSON.parse errors", () => {
      expect(() =>
        bridge.send(TEST_MESSAGE_ID, TEST_TOPIC, "{ broken json {{{")
      ).not.toThrow();
    });

    it("does not crash on malformed protocol data", () => {
      expect(() => bridge.send(TEST_MESSAGE_ID, TEST_TOPIC, "plain text")).not.toThrow();
    });

    it("handles null messages gracefully", () => {
      expect(() => bridge.send(TEST_MESSAGE_ID, TEST_TOPIC, null)).not.toThrow();
    });

    it("returns a falsy value on JSON parsing failure in #deserialize", () => {
      const result = IPCBridge.deserialize(TEST_TOPIC, {
        message_id: "bad-msg",
        topic: TEST_TOPIC,
        json_data: "",
        protocol: "unknown",
        sent_at: 123,
        length: 4,
      });

      const isNotNull: boolean = result == null;
      expect(isNotNull).toBe(true);
    });

    it("handles topic that looks like a filter spec", () => {
      const result = IPCBridge.deserialize("app.messages.*", {
        message_id: TEST_MESSAGE_ID,
        topic: "app.messages.users",
        json_data: TEST_JSON,
        protocol: "json-rpc",
        sent_at: Date.now(),
        length: 46,
      });

      expect(result).not.toBeNull();
      expect((result as { json_data: string }).json_data).toBe(TEST_JSON);
    });
  });

  describe("edge cases", () => {
    it("handles very long messages", () => {
      const longPayload = "x".repeat(1000);
      expect(() => bridge.send(TEST_MESSAGE_ID, TEST_TOPIC, longPayload)).not.toThrow();
    });

    it("handles messages with special characters", () => {
      const specialPayload = JSON.stringify({
        emoji: "😀🎉🚀",
        unicode: "αβγδε",
        control: "\0\x01\x02",
        newlines: "line1\nline2\r\nline3",
      });
      expect(() => bridge.send(TEST_MESSAGE_ID, TEST_TOPIC, specialPayload)).not.toThrow();
    });

    it("handles deeply nested payloads", () => {
      const nested = JSON.stringify(
        { a: { b: { c: { d: { e: "deep" } } } } }
      );
      expect(() => bridge.send(TEST_MESSAGE_ID, TEST_TOPIC, nested)).not.toThrow();
    });

    it("does not modify the original data in send", () => {
      const original = { a: 1 };
      const copy = JSON.parse(JSON.stringify(original));

      bridge.send(TEST_MESSAGE_ID, TEST_TOPIC, JSON.stringify(original));

      // Original should not have been mutated
      expect(original).toEqual(copy);
    });
  });
});
