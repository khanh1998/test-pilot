export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      // Define your database tables here
      // For example:
      // profiles: {
      //   Row: {
      //     id: string
      //     name: string | null
      //     email: string
      //   }
      //   Insert: {
      //     id: string
      //     name?: string | null
      //     email: string
      //   }
      //   Update: {
      //     id?: string
      //     name?: string | null
      //     email?: string
      //   }
      // }
    }
    Views: {
      // Define your database views here
    }
    Functions: {
      // Define your database functions here
    }
    Enums: {
      // Define your database enums here
    }
  }
}
