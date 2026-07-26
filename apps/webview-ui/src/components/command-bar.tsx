import { SearchIcon } from "lucide-react";
import { Button } from "./ui/button";

export default function CommandBar() {
  return (
    <Button
      variant="outline"
      className="w-80 justify-between hidden can-hover:sm:flex"
    >
      <div className="flex items-center gap-1.5">
        <SearchIcon />
        <span>Search</span>
      </div>
      <span className="opacity-50">⌘K</span>
    </Button>
  );
}
