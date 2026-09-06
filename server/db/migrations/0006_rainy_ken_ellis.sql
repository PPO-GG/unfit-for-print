CREATE TABLE "lobby_passwords" (
	"lobby_id" uuid PRIMARY KEY NOT NULL,
	"hash" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lobby_passwords" ADD CONSTRAINT "lobby_passwords_lobby_id_lobbies_id_fk" FOREIGN KEY ("lobby_id") REFERENCES "public"."lobbies"("id") ON DELETE cascade ON UPDATE no action;