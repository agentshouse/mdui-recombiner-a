import { parse } from "yaml";
import type { BookMeta } from "../model";

export function encodeBooks(books: BookMeta[]) {
  return JSON.stringify(books, undefined, 0);
}

export function decodeBooks(data: string): BookMeta[] {
  return parse(data) as BookMeta[];
}
