import test from 'node:test';
import assert from 'node:assert/strict';
import { TodoistTaskClientImpl } from './todoist-task-client.js';

test('TodoistTaskClientImpl reads tasks from the Todoist v1 tasks API', async function () {
  const originalFetch = globalThis.fetch;
  const calls: string[] = [];

  globalThis.fetch = async function mockFetch(input) {
    calls.push(String(input));

    return new Response(JSON.stringify({
      results: [
        {
          id: 'task-1',
          content: 'Reply to insurance email',
          description: '',
          url: 'https://todoist.com/showTask?id=task-1',
          due: {
            date: '2026-03-20',
            string: 'today',
            is_recurring: false
          }
        }
      ],
      next_cursor: null
    }), {
      status: 200,
      headers: {
        'content-type': 'application/json'
      }
    });
  } as typeof fetch;

  try {
    const client = new TodoistTaskClientImpl();
    const tasks = await client.listTasks('test-token');

    assert.equal(calls.length, 1);
    assert.equal(calls[0], 'https://api.todoist.com/api/v1/tasks');
    assert.deepEqual(tasks, [
      {
        id: 'task-1',
        content: 'Reply to insurance email',
        description: '',
        url: 'https://todoist.com/showTask?id=task-1',
        due: {
          date: '2026-03-20',
          string: 'today',
          isRecurring: false
        }
      }
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('TodoistTaskClientImpl follows pagination cursors', async function () {
  const originalFetch = globalThis.fetch;
  let callCount = 0;

  globalThis.fetch = async function mockFetch(input) {
    callCount += 1;
    const url = String(input);

    if (callCount === 1) {
      assert.equal(url, 'https://api.todoist.com/api/v1/tasks');

      return new Response(JSON.stringify({
        results: [
          {
            id: 'task-1',
            content: 'First page task'
          }
        ],
        next_cursor: 'cursor-2'
      }), { status: 200 });
    }

    assert.equal(url, 'https://api.todoist.com/api/v1/tasks?cursor=cursor-2');

    return new Response(JSON.stringify({
      results: [
        {
          id: 'task-2',
          content: 'Second page task'
        }
      ],
      next_cursor: null
    }), { status: 200 });
  } as typeof fetch;

  try {
    const client = new TodoistTaskClientImpl();
    const tasks = await client.listTasks('test-token');

    assert.equal(callCount, 2);
    assert.deepEqual(tasks.map(function mapTask(task) {
      return task.id;
    }), ['task-1', 'task-2']);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
