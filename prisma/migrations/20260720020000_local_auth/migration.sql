CREATE TABLE "local_auth_session" (
  "token_hash" TEXT NOT NULL,
  "user_id" INTEGER NOT NULL,
  "roles" TEXT[] NOT NULL DEFAULT ARRAY['admin']::TEXT[],
  "expires_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "local_auth_session_pkey" PRIMARY KEY ("token_hash"),
  CONSTRAINT "local_auth_session_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "local_auth_session_expires_at_idx" ON "local_auth_session"("expires_at");
