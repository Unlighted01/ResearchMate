import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ResearchCard } from "./ResearchCard";
import { StorageItem } from "../../../services/storageService";
import "@testing-library/jest-dom";

// Mock framer motion/motion react because it might have requestAnimationFrame issues in jsdom
vi.mock("motion/react", () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div {...props}>
        {children}
      </div>
    ),
    path: ({ children, ...props }: React.SVGProps<SVGPathElement>) => <path {...props}>{children}</path>,
    svg: ({ children, ...props }: React.SVGProps<SVGSVGElement>) => <svg {...props}>{children}</svg>,
  },
  useAnimate: () => [
    { current: null }, // scope
    vi.fn().mockResolvedValue(null), // animate function
  ],
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const mockItem: StorageItem = {
  id: "test-item-123",
  text: "This is a sample highlight text from a research paper.",
  tags: ["machine-learning", "nlp"],
  note: "This is a user note.",
  sourceUrl: "https://example.com/paper.pdf",
  sourceTitle: "Example Research Paper",
  createdAt: "2026-06-18T04:00:00.000Z",
  deviceSource: "extension",
  color: "yellow",
  pinned: true,
};

describe("ResearchCard", () => {
  it("renders item content, hostname, tags, and date correctly", () => {
    render(
      <ResearchCard
        item={mockItem}
        selectionActive={false}
        isSelected={false}
        onSelect={vi.fn()}
        onClick={vi.fn()}
        onDelete={vi.fn()}
        onPin={vi.fn()}
      />
    );

    // Verify text highlight is rendered
    expect(screen.getByText("This is a sample highlight text from a research paper.")).toBeInTheDocument();

    // Verify hostname is resolved and rendered
    expect(screen.getByText("example.com")).toBeInTheDocument();

    // Verify tags are rendered
    expect(screen.getByText("#machine-learning")).toBeInTheDocument();
    expect(screen.getByText("#nlp")).toBeInTheDocument();

    // Verify date is rendered (LocaleDateString depends on run env, just verify existence of date substring)
    expect(screen.getByText(/2026/)).toBeInTheDocument();
  });

  it("calls onClick when clicked", () => {
    const handleClick = vi.fn();
    render(
      <ResearchCard
        item={mockItem}
        selectionActive={false}
        isSelected={false}
        onSelect={vi.fn()}
        onClick={handleClick}
        onDelete={vi.fn()}
        onPin={vi.fn()}
      />
    );

    const card = screen.getByRole("button");
    fireEvent.click(card);

    expect(handleClick).toHaveBeenCalledWith(mockItem);
  });

  it("renders custom indicators like pinned status", () => {
    render(
      <ResearchCard
        item={mockItem}
        selectionActive={false}
        isSelected={false}
        onSelect={vi.fn()}
        onClick={vi.fn()}
        onDelete={vi.fn()}
        onPin={vi.fn()}
      />
    );

    // Look for Pin icon or tooltip
    const pinIndicator = screen.getByTitle("Pinned");
    expect(pinIndicator).toBeInTheDocument();
  });
});
