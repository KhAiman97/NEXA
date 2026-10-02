import "server-only";
import type { z } from "zod";
import { createCrud } from "../crud";
import {
  accountInput,
  bookInput,
  categoryInput,
  type Account,
  type Book,
  type Category,
} from "@/lib/validators/finance";

export const accounts = createCrud<Account, z.infer<typeof accountInput>>({ table: "finance_accounts", orderBy: "name", ascending: true });
export const categories = createCrud<Category, z.infer<typeof categoryInput>>({ table: "categories", orderBy: "name", ascending: true });
export const books = createCrud<Book, z.infer<typeof bookInput>>({ table: "books", orderBy: "created_at" });
