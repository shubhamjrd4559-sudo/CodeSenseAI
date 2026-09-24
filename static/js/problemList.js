/**
 * ProblemList.js
 * Manages the DSA Pattern Playbook Problem List module for CodeSense AI.
 * Renders problem sets from the PDF, handles direct LeetCode links, and enables topic pagination.
 */
const ProblemList = (() => {
  const dsaTopics = [
    {
      id: "arrays-hashing",
      number: "1",
      title: "Arrays & Hashing",
      concept: "Use a hash map / set to solve problems efficiently with constant time lookups.",
      takeaways: [
        "Key Pattern: HashMap / HashSet for complement lookups",
        "Frequency counting for anagrams and character frequencies",
        "Prefix & Suffix product arrays for cumulative operations",
        "Hashing 2D matrices (row, col, box index) for Sudoku validation"
      ],
      questions: [
        { num: "1.", title: "Two Sum", lc: 1, difficulty: "Easy", pattern: "HashMap / Complement", slug: "two-sum" },
        { num: "2.", title: "Contains Duplicate", lc: 217, difficulty: "Easy", pattern: "Set", slug: "contains-duplicate" },
        { num: "3.", title: "Valid Anagram", lc: 242, difficulty: "Easy", pattern: "Frequency Counting", slug: "valid-anagram" },
        { num: "4.", title: "Group Anagrams", lc: 49, difficulty: "Medium", pattern: "Hashing + Canonical Representation", slug: "group-anagrams" },
        { num: "5.", title: "Top K Frequent Elements", lc: 347, difficulty: "Medium", pattern: "HashMap + Heap", slug: "top-k-frequent-elements" },
        { num: "6.", title: "Product of Array Except Self", lc: 238, difficulty: "Medium", pattern: "Prefix & Suffix Product", slug: "product-of-array-except-self" },
        { num: "7.", title: "Encode and Decode Strings", lc: 271, difficulty: "Medium", pattern: "String Manipulation", slug: "encode-and-decode-strings" },
        { num: "8.", title: "Longest Consecutive Sequence", lc: 128, difficulty: "Medium", pattern: "Set / Hashing", slug: "longest-consecutive-sequence" },
        { num: "9.", title: "Valid Sudoku", lc: 36, difficulty: "Medium", pattern: "Hashing + 2D Array", slug: "valid-sudoku" }
      ]
    },
    {
      id: "two-pointers",
      number: "2",
      title: "Two Pointers",
      concept: "Use two pointers (usually from ends or different positions) to solve problems efficiently, often in sorted arrays or when finding pairs/triplets.",
      takeaways: [
        "Works great on sorted arrays to reduce O(N^2) to O(N)",
        "Pointers can move towards each other (left, right) or same direction (fast, slow)",
        "Often used for pair/triplet target sum & palindrome problems"
      ],
      questions: [
        { num: "12.", title: "3Sum", lc: 15, difficulty: "Medium", pattern: "Two Pointers (with sorting)", slug: "3sum" },
        { num: "13.", title: "Container With Most Water", lc: 11, difficulty: "Medium", pattern: "Two Pointers", slug: "container-with-most-water" },
        { num: "14.", title: "Valid Palindrome", lc: 125, difficulty: "Easy", pattern: "Two Pointers", slug: "valid-palindrome" },
        { num: "15.", title: "Two Sum II - Input Array Is Sorted", lc: 167, difficulty: "Medium", pattern: "Two Pointers (sorted array)", slug: "two-sum-ii-input-array-is-sorted" }
      ]
    },
    {
      id: "sliding-window",
      number: "3",
      title: "Sliding Window",
      concept: "Use a window (subarray/string) and move it to find the optimal solution. Helps in problems with contiguous elements, substrings, or fixed size windows.",
      takeaways: [
        "Extend the window to satisfy conditions, then shrink it to optimize",
        "Variable size window (e.g. min window) vs Fixed size window (e.g. max sum subarray)",
        "Combine with HashMap / HashSet for frequency tracking"
      ],
      questions: [
        { num: "7.", title: "Longest Substring Without Repeating Characters", lc: 3, difficulty: "Medium", pattern: "Sliding Window + Set", slug: "longest-substring-without-repeating-characters" },
        { num: "8.", title: "Longest Repeating Character Replacement", lc: 424, difficulty: "Medium", pattern: "Sliding Window + HashMap", slug: "longest-repeating-character-replacement" },
        { num: "9.", title: "Minimum Window Substring", lc: 76, difficulty: "Hard", pattern: "Sliding Window + HashMap", slug: "minimum-window-substring" },
        { num: "10.", title: "Permutation in String", lc: 567, difficulty: "Medium", pattern: "Sliding Window + HashMap", slug: "permutation-in-string" },
        { num: "11.", title: "Maximum Average Subarray I", lc: 643, difficulty: "Medium", pattern: "Sliding Window (Fixed Size)", slug: "maximum-average-subarray-i" }
      ]
    },
    {
      id: "stack",
      number: "4",
      title: "Stack",
      concept: "LIFO (Last In, First Out) data structure. Perfect for matching, parsing expressions, and maintaining monotonic sequences.",
      takeaways: [
        "Matching / validation problems (parentheses matching)",
        "Monotonic stack for finding next greater / smaller elements in O(N)",
        "Backtracking state management & Reverse Polish Notation"
      ],
      questions: [
        { num: "1.", title: "Valid Parentheses", lc: 20, difficulty: "Easy", pattern: "Stack (Matching)", slug: "valid-parentheses" },
        { num: "2.", title: "Min Stack", lc: 155, difficulty: "Medium", pattern: "Design (Stack + Min)", slug: "min-stack" },
        { num: "3.", title: "Evaluate Reverse Polish Notation", lc: 150, difficulty: "Medium", pattern: "Stack (Expression Evaluation)", slug: "evaluate-reverse-polish-notation" },
        { num: "4.", title: "Generate Parentheses", lc: 22, difficulty: "Medium", pattern: "Backtracking + Stack", slug: "generate-parentheses" },
        { num: "5.", title: "Daily Temperatures", lc: 739, difficulty: "Medium", pattern: "Monotonic Stack", slug: "daily-temperatures" },
        { num: "6.", title: "Car Fleet", lc: 853, difficulty: "Medium", pattern: "Stack (Monotonic)", slug: "car-fleet" },
        { num: "7.", title: "Largest Rectangle in Histogram", lc: 84, difficulty: "Hard", pattern: "Monotonic Stack", slug: "largest-rectangle-in-histogram" }
      ]
    },
    {
      id: "binary-search",
      number: "4.2",
      title: "Binary Search",
      concept: "Divide and conquer search algorithm operating on sorted arrays or monotonic answer spaces to find target in O(log N) time.",
      takeaways: [
        "Identify search space bounds (low, high) and invariant condition",
        "Binary search on answer space (e.g. Koko Eating Bananas)",
        "Modified binary search for rotated sorted arrays and 2D matrices"
      ],
      questions: [
        { num: "15.", title: "Binary Search", lc: 704, difficulty: "Easy", pattern: "Binary Search", slug: "binary-search" },
        { num: "16.", title: "Search in Rotated Sorted Array", lc: 33, difficulty: "Medium", pattern: "Modified Binary Search", slug: "search-in-rotated-sorted-array" },
        { num: "17.", title: "Find Minimum in Rotated Sorted Array", lc: 153, difficulty: "Medium", pattern: "Binary Search (min finding)", slug: "find-minimum-in-rotated-sorted-array" },
        { num: "18.", title: "Search a 2D Matrix", lc: 74, difficulty: "Medium", pattern: "Binary Search (2D)", slug: "search-a-2d-matrix" },
        { num: "19.", title: "Koko Eating Bananas", lc: 875, difficulty: "Medium", pattern: "Binary Search (answer space)", slug: "koko-eating-bananas" },
        { num: "20.", title: "Peak Index in a Mountain Array", lc: 852, difficulty: "Medium", pattern: "Binary Search (peak finding)", slug: "peak-index-in-a-mountain-array" }
      ]
    },
    {
      id: "linked-list",
      number: "5",
      title: "Linked List",
      concept: "Master pointer manipulation, node operations, and handling edge cases like empty lists or cycles.",
      takeaways: [
        "Use dummy head nodes to simplify boundary edge cases",
        "Fast & Slow pointer technique (Tortoise and Hare) for cycle detection and mid-point",
        "In-place list reversal and multi-list merging"
      ],
      questions: [
        { num: "21.", title: "Reverse Linked List", lc: 206, difficulty: "Easy", pattern: "Pointer Manipulation", slug: "reverse-linked-list" },
        { num: "22.", title: "Linked List Cycle", lc: 141, difficulty: "Easy", pattern: "Two Pointers / Fast & Slow", slug: "linked-list-cycle" },
        { num: "23.", title: "Merge Two Sorted Lists", lc: 21, difficulty: "Easy", pattern: "Two Pointers", slug: "merge-two-sorted-lists" },
        { num: "24.", title: "Merge K Sorted Lists", lc: 23, difficulty: "Hard", pattern: "Divide & Conquer / Heap", slug: "merge-k-sorted-lists" },
        { num: "25.", title: "Remove Nth Node From End of List", lc: 19, difficulty: "Medium", pattern: "Two Pointers", slug: "remove-nth-node-from-end-of-list" },
        { num: "26.", title: "Reorder List", lc: 143, difficulty: "Medium", pattern: "Fast & Slow / Reverse", slug: "reorder-list" }
      ]
    },
    {
      id: "trees",
      number: "7",
      title: "Trees",
      concept: "Hierarchical data structure with nodes and edges. Master DFS (preorder, inorder, postorder) and BFS (level order).",
      takeaways: [
        "Recursion & Depth-First Search (DFS) for path tracking & depth computation",
        "Breadth-First Search (BFS) using Queues for level-by-level traversal",
        "BST properties: left child < root < right child for fast lookup and inorder ordering"
      ],
      questions: [
        { num: "1.", title: "Invert Binary Tree", lc: 226, difficulty: "Easy", pattern: "Tree Traversal (DFS)", slug: "invert-binary-tree" },
        { num: "2.", title: "Maximum Depth of Binary Tree", lc: 104, difficulty: "Easy", pattern: "Tree Traversal (DFS)", slug: "maximum-depth-of-binary-tree" },
        { num: "3.", title: "Diameter of Binary Tree", lc: 543, difficulty: "Easy", pattern: "Tree Traversal (DFS)", slug: "diameter-of-binary-tree" },
        { num: "4.", title: "Balanced Binary Tree", lc: 110, difficulty: "Easy", pattern: "Tree Traversal (DFS)", slug: "balanced-binary-tree" },
        { num: "5.", title: "Same Tree", lc: 100, difficulty: "Easy", pattern: "Tree Traversal (DFS)", slug: "same-tree" },
        { num: "6.", title: "Subtree of Another Tree", lc: 572, difficulty: "Easy", pattern: "Tree Traversal (DFS)", slug: "subtree-of-another-tree" },
        { num: "7.", title: "Lowest Common Ancestor of BST", lc: 235, difficulty: "Medium", pattern: "Recursion / BST Properties", slug: "lowest-common-ancestor-of-a-binary-search-tree" },
        { num: "8.", title: "Binary Tree Level Order Traversal", lc: 102, difficulty: "Medium", pattern: "BFS (Level Order)", slug: "binary-tree-level-order-traversal" },
        { num: "9.", title: "Binary Tree Right Side View", lc: 199, difficulty: "Medium", pattern: "BFS (Level Order)", slug: "binary-tree-right-side-view" },
        { num: "10.", title: "Count Good Nodes in Binary Tree", lc: 1448, difficulty: "Medium", pattern: "DFS (Path Tracking)", slug: "count-good-nodes-in-binary-tree" },
        { num: "11.", title: "Validate Binary Search Tree", lc: 98, difficulty: "Medium", pattern: "BST Properties", slug: "validate-binary-search-tree" },
        { num: "12.", title: "Kth Smallest Element in BST", lc: 230, difficulty: "Medium", pattern: "BST Inorder Traversal", slug: "kth-smallest-element-in-a-bst" },
        { num: "13.", title: "Construct Binary Tree from Preorder & Inorder", lc: 105, difficulty: "Medium", pattern: "Tree Construction", slug: "construct-binary-tree-from-preorder-and-inorder-traversal" },
        { num: "14.", title: "Binary Tree Maximum Path Sum", lc: 124, difficulty: "Hard", pattern: "DFS (Path Sum)", slug: "binary-tree-maximum-path-sum" },
        { num: "15.", title: "Serialize and Deserialize Binary Tree", lc: 297, difficulty: "Hard", pattern: "BFS / DFS (Tree Encoding)", slug: "serialize-and-deserialize-binary-tree" }
      ]
    },
    {
      id: "tries",
      number: "8",
      title: "Tries",
      concept: "A tree-like prefix tree structure used for fast string insertion, search, and prefix matching.",
      takeaways: [
        "Operations: insert(word), search(word), startsWith(prefix)",
        "Optimal for auto-complete, dictionary search, and word matching",
        "Reduces time complexity compared to simple string scanning"
      ],
      questions: [
        { num: "1.", title: "Implement Trie (Prefix Tree)", lc: 208, difficulty: "Medium", pattern: "Trie (Basic Implementation)", slug: "implement-trie-prefix-tree" },
        { num: "2.", title: "Design Add and Search Words Data Structure", lc: 211, difficulty: "Medium", pattern: "Trie (Wildcard Search)", slug: "design-add-and-search-words-data-structure" },
        { num: "3.", title: "Word Search II", lc: 212, difficulty: "Hard", pattern: "Trie + Backtracking", slug: "word-search-ii" }
      ]
    },
    {
      id: "heap-priority-queue",
      number: "11",
      title: "Heap / Priority Queue",
      concept: "Tree-based structure that maintains partial order. Used for tracking Top-K elements, median streaming, and greedy scheduling.",
      takeaways: [
        "Min Heap keeps smallest element at root; Max Heap keeps largest element at root",
        "Two heaps (min heap + max heap) pattern for finding running median",
        "Custom comparator for K-way merge operations"
      ],
      questions: [
        { num: "1.", title: "Kth Largest Element in an Array", lc: 215, difficulty: "Medium", pattern: "Min / Max Heap", slug: "kth-largest-element-in-an-array" },
        { num: "2.", title: "Top K Frequent Words", lc: 692, difficulty: "Medium", pattern: "Min Heap (Size K)", slug: "top-k-frequent-words" },
        { num: "3.", title: "Find Median from Data Stream", lc: 295, difficulty: "Hard", pattern: "Two Heaps (Min + Max)", slug: "find-median-from-data-stream" },
        { num: "4.", title: "Task Scheduler", lc: 621, difficulty: "Medium", pattern: "Max Heap (Greedy)", slug: "task-scheduler" },
        { num: "5.", title: "Kth Smallest Element in a Sorted Matrix", lc: 378, difficulty: "Medium", pattern: "Min Heap (K Way Merge)", slug: "kth-smallest-element-in-a-sorted-matrix" }
      ]
    },
    {
      id: "backtracking",
      number: "12",
      title: "Backtracking",
      concept: "Systematically explore all possibilities by building candidate solutions incrementally and undoing choices when constraints fail.",
      takeaways: [
        "Framework: Choose -> Explore (recurse) -> Unchoose (backtrack)",
        "Subset generation, combination sums, and permutation search",
        "Grid pruning and constraint satisfaction (N-Queens, Sudoku)"
      ],
      questions: [
        { num: "1.", title: "Subsets", lc: 78, difficulty: "Medium", pattern: "Backtracking + Recursion", slug: "subsets" },
        { num: "2.", title: "Combination Sum", lc: 39, difficulty: "Medium", pattern: "Backtracking + Sum Constraint", slug: "combination-sum" },
        { num: "3.", title: "Permutations", lc: 46, difficulty: "Medium", pattern: "Backtracking + Swap / Visited", slug: "permutations" },
        { num: "4.", title: "Subsets II", lc: 90, difficulty: "Medium", pattern: "Backtracking + Duplicates", slug: "subsets-ii" },
        { num: "5.", title: "Word Search", lc: 79, difficulty: "Medium", pattern: "Backtracking + 2D DFS", slug: "word-search" },
        { num: "6.", title: "N-Queens", lc: 51, difficulty: "Hard", pattern: "Backtracking + Constraints", slug: "n-queens" },
        { num: "7.", title: "Sudoku Solver", lc: 37, difficulty: "Hard", pattern: "Backtracking + 9x9 Grid", slug: "sudoku-solver" }
      ]
    },
    {
      id: "graphs",
      number: "14",
      title: "Graphs",
      concept: "Collection of nodes and edges representing relationships. Master DFS/BFS traversals, Union-Find, and Topological Sort.",
      takeaways: [
        "Grid traversals (4-directional DFS/BFS) for island & region problems",
        "Topological Sort (Kahn's BFS or DFS post-order) for dependency ordering",
        "Union-Find (Disjoint Set Union) for cycle detection and connected components"
      ],
      questions: [
        { num: "1.", title: "Number of Islands", lc: 200, difficulty: "Medium", pattern: "DFS / BFS (Grid)", slug: "number-of-islands" },
        { num: "2.", title: "Clone Graph", lc: 133, difficulty: "Medium", pattern: "DFS / BFS (Graph)", slug: "clone-graph" },
        { num: "3.", title: "Max Area of Island", lc: 695, difficulty: "Medium", pattern: "DFS / BFS (Grid)", slug: "max-area-of-island" },
        { num: "4.", title: "Pacific Atlantic Water Flow", lc: 417, difficulty: "Medium", pattern: "DFS / BFS (Multi-source)", slug: "pacific-atlantic-water-flow" },
        { num: "5.", title: "Surrounded Regions", lc: 130, difficulty: "Medium", pattern: "DFS / BFS (Grid)", slug: "surrounded-regions" },
        { num: "6.", title: "Rotting Oranges", lc: 994, difficulty: "Medium", pattern: "BFS (Multi-source)", slug: "rotting-oranges" },
        { num: "7.", title: "Course Schedule", lc: 207, difficulty: "Medium", pattern: "Topological Sort (BFS/DFS)", slug: "course-schedule" },
        { num: "8.", title: "Graph Valid Tree", lc: 261, difficulty: "Medium", pattern: "Union Find / BFS / DFS", slug: "graph-valid-tree" },
        { num: "9.", title: "Number of Connected Components", lc: 323, difficulty: "Medium", pattern: "DFS / Union Find", slug: "number-of-connected-components-in-an-undirected-graph" }
      ]
    },
    {
      id: "dynamic-programming",
      number: "16",
      title: "Dynamic Programming",
      concept: "Optimize recursive problems with overlapping subproblems using top-down memoization or bottom-up tabulation.",
      takeaways: [
        "1D DP for linear decisions (Climbing Stairs, House Robber)",
        "2D DP for grid paths, string edit distances, and intervals",
        "Identify state transitions & base cases before coding"
      ],
      questions: [
        { num: "1.", title: "Climbing Stairs", lc: 70, difficulty: "Easy", pattern: "1D DP (Fibonacci)", slug: "climbing-stairs" },
        { num: "2.", title: "House Robber", lc: 198, difficulty: "Medium", pattern: "1D DP (Max non-adjacent sum)", slug: "house-robber" },
        { num: "3.", title: "House Robber II", lc: 213, difficulty: "Medium", pattern: "1D DP (Circular array)", slug: "house-robber-ii" },
        { num: "4.", title: "Longest Palindromic Substring", lc: 5, difficulty: "Medium", pattern: "2D DP (Expand / Table)", slug: "longest-palindromic-substring" },
        { num: "5.", title: "Palindromic Substrings", lc: 647, difficulty: "Medium", pattern: "2D DP (Expand / Table)", slug: "palindromic-substrings" },
        { num: "6.", title: "Decode Ways", lc: 91, difficulty: "Medium", pattern: "1D DP (String decoding)", slug: "decode-ways" },
        { num: "7.", title: "Coin Change", lc: 322, difficulty: "Medium", pattern: "1D DP (Min coins)", slug: "coin-change" },
        { num: "8.", title: "Maximum Product Subarray", lc: 152, difficulty: "Medium", pattern: "1D DP (Track min & max)", slug: "maximum-product-subarray" },
        { num: "9.", title: "Word Break", lc: 139, difficulty: "Medium", pattern: "1D DP (String segmentation)", slug: "word-break" },
        { num: "10.", title: "Longest Increasing Subsequence", lc: 300, difficulty: "Medium", pattern: "1D DP (Binary search / DP)", slug: "longest-increasing-subsequence" },
        { num: "11.", title: "Partition Equal Subset Sum", lc: 416, difficulty: "Medium", pattern: "1D DP (Subset sum)", slug: "partition-equal-subset-sum" }
      ]
    }
  ];

  let currentTopicIndex = 0;
  let activeDifficulty = "all";
  let searchQuery = "";

  function getLeetCodeUrl(q) {
    if (q.slug) {
      return `https://leetcode.com/problems/${q.slug}/`;
    }
    return `https://leetcode.com/problemset/all/?search=${q.lc}`;
  }

  function init() {
    setupDomEvents();
    populateTopicDropdown();
    renderCurrentTopic();
  }

  function setupDomEvents() {
    // Open modal button in editor toolbar
    const openBtn = document.getElementById("open-problem-list-btn");
    if (openBtn) {
      openBtn.addEventListener("click", openModal);
    }

    // Quick navigation arrows in editor toolbar
    const prevArrow = document.getElementById("prev-topic-btn");
    const nextArrow = document.getElementById("next-topic-btn");
    if (prevArrow) {
      prevArrow.addEventListener("click", () => {
        navigateTopic(-1);
        openModal();
      });
    }
    if (nextArrow) {
      nextArrow.addEventListener("click", () => {
        navigateTopic(1);
        openModal();
      });
    }

    // Modal controls
    const closeBtn = document.getElementById("problem-list-close-btn");
    const modalBackdrop = document.getElementById("problem-list-modal");
    if (closeBtn) {
      closeBtn.addEventListener("click", closeModal);
    }
    if (modalBackdrop) {
      modalBackdrop.addEventListener("click", (e) => {
        if (e.target === modalBackdrop) closeModal();
      });
    }

    const modalPrevBtn = document.getElementById("modal-prev-topic-btn");
    const modalNextBtn = document.getElementById("modal-next-topic-btn");
    if (modalPrevBtn) modalPrevBtn.addEventListener("click", () => navigateTopic(-1));
    if (modalNextBtn) modalNextBtn.addEventListener("click", () => navigateTopic(1));

    const topicSelect = document.getElementById("pl-topic-select");
    if (topicSelect) {
      topicSelect.addEventListener("change", (e) => {
        currentTopicIndex = parseInt(e.target.value, 10) || 0;
        renderCurrentTopic();
      });
    }

    const searchInput = document.getElementById("pl-search-input");
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        searchQuery = e.target.value.toLowerCase().trim();
        renderCurrentTopic();
      });
    }

    const diffChips = document.querySelectorAll(".pl-diff-chip");
    diffChips.forEach((chip) => {
      chip.addEventListener("click", (e) => {
        diffChips.forEach((c) => c.classList.remove("active"));
        chip.classList.add("active");
        activeDifficulty = chip.getAttribute("data-diff") || "all";
        renderCurrentTopic();
      });
    });
  }

  function openModal() {
    const modal = document.getElementById("problem-list-modal");
    if (modal) {
      modal.hidden = false;
      modal.style.display = "flex";
    }
  }

  function closeModal() {
    const modal = document.getElementById("problem-list-modal");
    if (modal) {
      modal.hidden = true;
      modal.style.display = "none";
    }
  }

  function navigateTopic(direction) {
    currentTopicIndex += direction;
    if (currentTopicIndex < 0) {
      currentTopicIndex = dsaTopics.length - 1;
    } else if (currentTopicIndex >= dsaTopics.length) {
      currentTopicIndex = 0;
    }
    const topicSelect = document.getElementById("pl-topic-select");
    if (topicSelect) topicSelect.value = String(currentTopicIndex);
    renderCurrentTopic();
  }

  function populateTopicDropdown() {
    const topicSelect = document.getElementById("pl-topic-select");
    if (!topicSelect) return;
    topicSelect.innerHTML = "";
    dsaTopics.forEach((topic, idx) => {
      const opt = document.createElement("option");
      opt.value = idx;
      opt.textContent = `${topic.number}. ${topic.title} (${topic.questions.length})`;
      topicSelect.appendChild(opt);
    });
  }

  function renderCurrentTopic() {
    const topic = dsaTopics[currentTopicIndex];
    if (!topic) return;

    // Render Banner / Takeaways
    const bannerEl = document.getElementById("pl-topic-banner");
    if (bannerEl) {
      let takeawaysHtml = topic.takeaways.map(t => `<li>${escapeHtml(t)}</li>`).join("");
      bannerEl.innerHTML = `
        <div class="pl-topic-header-row">
          <span class="pl-topic-badge">Category #${escapeHtml(topic.number)}</span>
          <h3 class="pl-topic-title">${escapeHtml(topic.title)}</h3>
        </div>
        <p class="pl-topic-concept">${escapeHtml(topic.concept)}</p>
        <div class="pl-takeaways-box">
          <strong class="pl-takeaways-heading">Key Takeaways &amp; Patterns:</strong>
          <ul>${takeawaysHtml}</ul>
        </div>
      `;
    }

    // Filter questions
    let filteredQuestions = topic.questions.filter((q) => {
      const matchesDiff = (activeDifficulty === "all") || (q.difficulty.toLowerCase() === activeDifficulty.toLowerCase());
      const matchesQuery = !searchQuery || 
        q.title.toLowerCase().includes(searchQuery) || 
        String(q.lc).includes(searchQuery) ||
        q.pattern.toLowerCase().includes(searchQuery);
      return matchesDiff && matchesQuery;
    });

    const tbody = document.getElementById("pl-questions-tbody");
    if (!tbody) return;

    if (filteredQuestions.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="pl-no-results">
            No matching problems found for "${escapeHtml(searchQuery)}" with filter "${escapeHtml(activeDifficulty)}".
          </td>
        </tr>
      `;
      return;
    }

    let rowsHtml = filteredQuestions.map((q) => {
      const lcUrl = getLeetCodeUrl(q);
      const diffClass = q.difficulty.toLowerCase() === "easy" ? "diff-badge-easy" :
                        q.difficulty.toLowerCase() === "medium" ? "diff-badge-medium" : "diff-badge-hard";
      return `
        <tr>
          <td class="pl-cell-num">${escapeHtml(q.num)}</td>
          <td class="pl-cell-title">
            <a href="${lcUrl}" target="_blank" rel="noopener noreferrer" class="pl-problem-link" title="Open ${escapeHtml(q.title)} on LeetCode">
              ${escapeHtml(q.title)}
            </a>
          </td>
          <td class="pl-cell-lc"><span class="pl-lc-tag">LC #${q.lc}</span></td>
          <td class="pl-cell-diff"><span class="pl-diff-badge ${diffClass}">${q.difficulty}</span></td>
          <td class="pl-cell-pattern">${escapeHtml(q.pattern)}</td>
          <td class="pl-cell-action">
            <a href="${lcUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-leetcode-practice" title="Practice LC #${q.lc} directly on LeetCode">
              <svg viewBox="0 0 24 24" fill="currentColor" width="13" height="13" style="margin-right:4px;">
                <path d="M13.5 3H21v7.5h-2V6.41l-9.79 9.8-1.42-1.42 9.8-9.79H13.5V3zM5 5h6v2H5v12h12v-6h2v6a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z"/>
              </svg>
              Practice
            </a>
          </td>
        </tr>
      `;
    }).join("");

    tbody.innerHTML = rowsHtml;
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  document.addEventListener("DOMContentLoaded", init);

  return {
    init,
    openModal,
    closeModal,
    navigateTopic,
    dsaTopics
  };
})();
