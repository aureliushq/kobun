import { createContext } from "react-router"
import type { Database } from "./types"

export const dbContext = createContext<Database>()
