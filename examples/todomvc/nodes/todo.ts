import assert from 'node:assert/strict';
import { defineNode, z } from '@midscene/test';
import type { Page } from 'playwright';

const todoItemSchema = z.strictObject({
  title: z.string().trim().min(1),
  completed: z.boolean(),
});

const seedInputSchema = z.strictObject({
  items: z.array(z.string().trim().min(1)).min(1),
});

const expectStateInputSchema = z.strictObject({
  items: z.array(todoItemSchema),
});

type TodoItem = z.infer<typeof todoItemSchema>;

async function readTodoState(page: Page) {
  const items = await page.locator('.todo-list li').evaluateAll((elements) =>
    elements.map((element) => ({
      title: element.querySelector('label')?.textContent?.trim() ?? '',
      completed: element.classList.contains('completed'),
    })),
  );
  const completed = items.filter((item) => item.completed).length;
  return {
    items,
    total: items.length,
    completed,
    remaining: items.length - completed,
  };
}

type TodoState = Awaited<ReturnType<typeof readTodoState>>;

export function createTodoNodes<TContext extends { page: Page }>() {
  const seed = defineNode<typeof seedInputSchema, TodoState, TContext>({
    name: 'todo.seed',
    description:
      'Reset TodoMVC and create an ordered list through the visible UI.',
    inputSchema: seedInputSchema,
    async execute({ input, context: { page }, signal }) {
      signal.throwIfAborted();
      await page.evaluate(() => window.localStorage.clear());
      await page.reload({ waitUntil: 'domcontentloaded' });
      const inputBox = page.locator('.new-todo');
      for (const title of input.items) {
        signal.throwIfAborted();
        await inputBox.fill(title);
        await inputBox.press('Enter');
      }
      const state = await readTodoState(page);
      const expected: TodoItem[] = input.items.map((title) => ({
        title,
        completed: false,
      }));
      assert.deepEqual(state.items, expected, 'TodoMVC seeding failed');
      return { summary: `Created ${state.total} Todos.`, data: state };
    },
  });

  const expectState = defineNode<
    typeof expectStateInputSchema,
    TodoState,
    TContext
  >({
    name: 'todo.expectState',
    description: 'Require the exact ordered Todo titles and completed states.',
    inputSchema: expectStateInputSchema,
    async execute({ input, context: { page }, signal }) {
      signal.throwIfAborted();
      const state = await readTodoState(page);
      assert.deepEqual(state.items, input.items, 'Unexpected TodoMVC state');
      return {
        summary: `Verified ${state.total} Todos: ${state.completed} completed, ${state.remaining} remaining.`,
        data: state,
      };
    },
  });

  const captureState = defineNode<unknown, TodoState, TContext>({
    name: 'todo.captureState',
    description:
      'Capture TodoMVC DOM state after each case, including failures.',
    inputSchema: z.strictObject({}),
    async execute({ context: { page }, signal }) {
      signal.throwIfAborted();
      const state = await readTodoState(page);
      return { summary: `Captured ${state.total} Todos.`, data: state };
    },
  });

  return [seed, expectState, captureState];
}
