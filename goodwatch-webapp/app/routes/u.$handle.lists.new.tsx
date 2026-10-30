// The editor for a new share list inside the owner's profile: /u/:handle/lists/new, under the profile header with
// the Lists tab lit. The page is the one at /lists/new (lists.new.tsx); its loader sends everyone but the owner on:
// guests and members without a handle to /lists/new, other members to their own /u/:handle/lists/new.
export { default, headers, loader, meta } from "./lists.new"
