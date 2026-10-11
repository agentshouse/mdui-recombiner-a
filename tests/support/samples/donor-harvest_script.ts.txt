import { readFile, writeFile } from "node:fs/promises";
import { parse } from "yaml";
import { type BookQuery, harvestBook } from "./harvest.ts";
import type { Book } from "./store.ts";

async function main(books_file = "books.yml", chapters_file = "chapters.json") {
  const queries = parse(await readFile(books_file, "utf-8")) as BookQuery[];
  const books: Book[] = [];
  for (const query of queries) {
    console.log("Harvesting chapters for: ", query.html_url);
    const book = await harvestBook(query);
    books.push(book);
  }
  await writeFile(chapters_file, JSON.stringify(books, null, 2));
}

await main();
