"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import AlignmentViewer from "@/components/AlignmentViewer"
import LLMAlignmentViewer from "@/components/LLMAlignmentViewer"

// Mock test data simulating backend responses
interface AlignmentData {
  source: string;
  target: string;
  confidence: number;
  refined?: boolean;
}

interface TestCaseData {
  original: string;
  translation: string;
  tokens: {
    source: string[];
    target: string[];
  };
  alignments: AlignmentData[];
}

interface TestCase {
  id: number;
  title: string;
  description: string;
  data: TestCaseData;
}

// Mock LLM alignment data
const llmTestCases = [
  {
    id: 1,
    title: "Simple Persian Sentence",
    sourceText: "بستنی خریدیم",
    targetText: "We bought ice cream",
    result: {
      phrase_alignments: [
        { source: "بستنی خریدیم", target: "we bought ice cream", confidence: 0.9, refined: true }
      ],
      word_alignments: [
        { source: "بستنی", target: "ice cream", confidence: 0.8, refined: true },
        { source: "خریدیم", target: "we bought", confidence: 0.8, refined: true }
      ],
      timing: { total: 2.5 },
      raw_response: '{"phrase_alignments": [{"source": "بستنی خریدیم", "target": "we bought ice cream"}], "word_alignments": [{"source": "بستنی", "target": "ice cream"}, {"source": "خریدیم", "target": "we bought"}]}'
    }
  },
  {
    id: 2,
    title: "Complex Persian Sentence",
    sourceText: "دیروز با خانواده‌ام به پارک رفتیم.",
    targetText: "Yesterday we went to the park with my family.",
    result: {
      phrase_alignments: [
        { source: "دیروز با خانواده‌ام به پارک رفتیم", target: "Yesterday we went to the park with my family", confidence: 0.9, refined: true }
      ],
      word_alignments: [
        { source: "دیروز", target: "Yesterday", confidence: 0.8, refined: true },
        { source: "با", target: "with", confidence: 0.8, refined: true },
        { source: "خانواده‌ام", target: "my family", confidence: 0.8, refined: true },
        { source: "به", target: "to", confidence: 0.8, refined: true },
        { source: "پارک", target: "the park", confidence: 0.8, refined: true },
        { source: "رفتیم", target: "we went", confidence: 0.8, refined: true }
      ],
      timing: { total: 3.1 }
    }
  },
  {
    id: 3,
    title: "Weather Description",
    sourceText: "هوا آفتابی و بسیار دلپذیر بود.",
    targetText: "The weather was sunny and very pleasant.",
    result: {
      phrase_alignments: [
        { source: "هوا آفتابی و بسیار دلپذیر بود", target: "The weather was sunny and very pleasant", confidence: 0.9, refined: true }
      ],
      word_alignments: [
        { source: "هوا", target: "the weather", confidence: 0.8, refined: true },
        { source: "آفتابی", target: "sunny", confidence: 0.8, refined: true },
        { source: "و", target: "and", confidence: 0.8, refined: true },
        { source: "بسیار", target: "very", confidence: 0.8, refined: true },
        { source: "دلپذیر", target: "pleasant", confidence: 0.8, refined: true },
        { source: "بود", target: "was", confidence: 0.8, refined: true }
      ],
      timing: { total: 2.8 }
    }
  }
];

const testCases: TestCase[] = [
  {
    id: 1,
    title: "Basic Multi-word Alignment",
    description: "Testing single → single and multi-word → multi-word alignments",
    data: {
      original: "سلام حالت چطوره",
      translation: "Hello how are you",
      tokens: {
        source: ["سلام", "حالت", "چطوره"],
        target: ["Hello", "how", "are", "you"]
      },
      alignments: [
        { source: "سلام", target: "Hello", confidence: 0.95 },
        { source: "حالت چطوره", target: "how are you", confidence: 0.85 }
      ]
    }
  },
  {
    id: 2,
    title: "Complex Multi-word Phrases",
    description: "Testing multiple multi-word phrase alignments in longer sentence",
    data: {
      original: "دیروز با خانواده‌ام به پارک رفتیم و بستنی خریدیم",
      translation: "Yesterday I went to the park with my family and bought ice cream",
      tokens: {
        source: ["دیروز", "با", "خانواده‌ام", "به", "پارک", "رفتیم", "و", "بستنی", "خریدیم"],
        target: ["Yesterday", "I", "went", "to", "the", "park", "with", "my", "family", "and", "bought", "ice", "cream"]
      },
      alignments: [
        { source: "دیروز", target: "Yesterday", confidence: 0.98 },
        { source: "با خانواده‌ام", target: "with my family", confidence: 0.82 },
        { source: "به پارک", target: "to the park", confidence: 0.88 },
        { source: "رفتیم", target: "went", confidence: 0.75 },
        { source: "بستنی", target: "ice cream", confidence: 0.90 },
        { source: "خریدیم", target: "bought", confidence: 0.85 }
      ]
    }
  },
  {
    id: 3,
    title: "Mixed Confidence Levels",
    description: "Testing high and low confidence phrase alignments",
    data: {
      original: "من کتاب جدید خریدم",
      translation: "I bought a new book",
      tokens: {
        source: ["من", "کتاب", "جدید", "خریدم"],
        target: ["I", "bought", "a", "new", "book"]
      },
      alignments: [
        { source: "من", target: "I", confidence: 0.99 },
        { source: "کتاب جدید", target: "new book", confidence: 0.65 }, // Low confidence - should show orange
        { source: "خریدم", target: "bought", confidence: 0.92 }
      ]
    }
  },
  {
    id: 4,
    title: "Single Word to Multi-word",
    description: "Testing single source words mapping to multiple target words",
    data: {
      original: "بستنی خوردم",
      translation: "I ate ice cream",
      tokens: {
        source: ["بستنی", "خوردم"],
        target: ["I", "ate", "ice", "cream"]
      },
      alignments: [
        { source: "بستنی", target: "ice cream", confidence: 0.88 },
        { source: "خوردم", target: "I ate", confidence: 0.78 }
      ]
    }
  },
  {
    id: 5,
    title: "LLM Refinement - Partial Collocations",
    description: "Testing partial collocation detection and LLM refinement triggers",
    data: {
      original: "حالت چطوره امروز",
      translation: "are you well today",
      tokens: {
        source: ["حالت", "چطوره", "امروز"],
        target: ["are", "you", "well", "today"]
      },
      alignments: [
        { source: "حالت چطوره", target: "are you", confidence: 0.45, refined: true }, // Low confidence + refined flag
        { source: "امروز", target: "today", confidence: 0.92 }
      ]
    }
  },
  {
    id: 6,
    title: "Multi-to-One LLM Trigger",
    description: "Testing multi-source to single-target LLM refinement",
    data: {
      original: "به طور کلی موافقم",
      translation: "I generally agree",
      tokens: {
        source: ["به", "طور", "کلی", "موافقم"],
        target: ["I", "generally", "agree"]
      },
      alignments: [
        { source: "به طور کلی", target: "generally", confidence: 0.55, refined: true }, // Multi→one trigger
        { source: "موافقم", target: "I agree", confidence: 0.82 }
      ]
    }
  },
  {
    id: 7,
    title: "One-to-Multi LLM Trigger",
    description: "Testing single-source to multi-target LLM refinement",
    data: {
      original: "صبحانه خوردم",
      translation: "I had breakfast meal",
      tokens: {
        source: ["صبحانه", "خوردم"],
        target: ["I", "had", "breakfast", "meal"]
      },
      alignments: [
        { source: "صبحانه", target: "breakfast meal", confidence: 0.58, refined: true }, // One→multi trigger
        { source: "خوردم", target: "I had", confidence: 0.75 }
      ]
    }
  },
  {
    id: 8,
    title: "Span Embedding Enhancement",
    description: "Testing span-level similarity confidence boosting",
    data: {
      original: "دیروز کار کردم",
      translation: "yesterday I worked",
      tokens: {
        source: ["دیروز", "کار", "کردم"],
        target: ["yesterday", "I", "worked"]
      },
      alignments: [
        { source: "دیروز", target: "yesterday", confidence: 0.94 },
        { source: "کار کردم", target: "I worked", confidence: 0.85 } // Enhanced by span similarity
      ]
    }
  },
  {
    id: 9,
    title: "Complex Mixed Scenario",
    description: "Testing all enhancement features together",
    data: {
      original: "دیروز با خانواده‌ام به طور کلی خوش گذشت",
      translation: "yesterday with my family generally had good time",
      tokens: {
        source: ["دیروز", "با", "خانواده‌ام", "به", "طور", "کلی", "خوش", "گذشت"],
        target: ["yesterday", "with", "my", "family", "generally", "had", "good", "time"]
      },
      alignments: [
        { source: "دیروز", target: "yesterday", confidence: 0.96 },
        { source: "با خانواده‌ام", target: "with my family", confidence: 0.88 }, // Collocation + span enhancement
        { source: "به طور کلی", target: "generally", confidence: 0.52, refined: true }, // Multi→one + LLM refined
        { source: "خوش گذشت", target: "had good time", confidence: 0.73 } // Multi→multi span enhancement
      ]
    }
  },
  {
    id: 10,
    title: "Idiom Pattern Detection",
    description: "Testing Persian idiom/preposition pattern triggers",
    data: {
      original: "از این موضوع راضی نیستم",
      translation: "I am not satisfied with this matter",
      tokens: {
        source: ["از", "این", "موضوع", "راضی", "نیستم"],
        target: ["I", "am", "not", "satisfied", "with", "this", "matter"]
      },
      alignments: [
        { source: "از این موضوع", target: "with this matter", confidence: 0.62, refined: true }, // Idiom pattern trigger
        { source: "راضی نیستم", target: "I am not satisfied", confidence: 0.79 }
      ]
    }
  }
];

export default function TestAlignmentPage() {
  const [selectedTest, setSelectedTest] = useState<TestCase>(testCases[0]);
  const [selectedLLMTest, setSelectedLLMTest] = useState(llmTestCases[0]);

  // Convert mock data format to AlignmentViewer expected format
  const convertToAlignmentFormat = (data: TestCaseData) => {
    const phraseAlignments = data.alignments.map(alignment => ({
      source: alignment.source,
      target: alignment.target,
      confidence: alignment.confidence,
      refined: alignment.refined || false, // Include LLM refinement flag
      // These spans aren't used by our updated implementation, but keep for compatibility
      sourceSpan: { start: 0, end: 0 },
      targetSpan: { start: 0, end: 0 }
    }));

    return {
      original: data.tokens.source,
      translation: data.tokens.target,
      phraseAlignments
    };
  };

  const alignmentData = convertToAlignmentFormat(selectedTest.data);

  return (
    <div className="container mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Alignment Visualization Test</h1>
        <p className="text-muted-foreground mt-2">
          Test harness for both traditional word alignment and new LLM dual-level alignment
        </p>
      </div>

      {/* LLM Alignment Demo */}
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">LLM Dual-Level Alignment</h2>
          <p className="text-muted-foreground mt-2">
            New alignment system showing both phrase-level and word-level mappings from LLM output
          </p>
        </div>

        {/* LLM Test Case Selector */}
        <Card>
          <CardHeader>
            <CardTitle>LLM Test Cases</CardTitle>
            <CardDescription>Select an LLM alignment test case to visualize</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {llmTestCases.map((testCase) => (
                <Button
                  key={testCase.id}
                  variant={selectedLLMTest.id === testCase.id ? "default" : "outline"}
                  className="h-auto p-4 text-left justify-start"
                  onClick={() => setSelectedLLMTest(testCase)}
                >
                  <div>
                    <div className="font-semibold">{testCase.title}</div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {testCase.result.phrase_alignments.length} phrase, {testCase.result.word_alignments.length} word alignments
                    </div>
                    <Badge variant="outline" className="mt-2 text-xs border-blue-300 text-blue-700">
                      LLM Generated
                    </Badge>
                  </div>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* LLM Alignment Visualization */}
        <LLMAlignmentViewer
          sourceText={selectedLLMTest.sourceText}
          targetText={selectedLLMTest.targetText}
          alignmentResult={selectedLLMTest.result}
          sourceLanguage="Persian"
          targetLanguage="English"
        />
      </div>

      <div className="border-t pt-8">
        <h2 className="text-2xl font-bold tracking-tight mb-4">Traditional Word Alignment</h2>
        <p className="text-muted-foreground mb-6">
          Original alignment visualization for comparison
        </p>
      </div>

      {/* Test Case Selector */}
      <Card>
        <CardHeader>
          <CardTitle>Test Cases</CardTitle>
          <CardDescription>Select a test case to visualize alignment behavior</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {testCases.map((testCase) => (
              <Button
                key={testCase.id}
                variant={selectedTest.id === testCase.id ? "default" : "outline"}
                className="h-auto p-4 text-left justify-start"
                onClick={() => setSelectedTest(testCase)}
              >
                <div>
                  <div className="font-semibold">{testCase.title}</div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {testCase.description}
                  </div>
                  {testCase.data.alignments.some(a => a.refined) && (
                    <Badge variant="outline" className="mt-2 text-xs border-orange-300 text-orange-700">
                      LLM Enhanced
                    </Badge>
                  )}
                </div>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Selected Test Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {selectedTest.title}
            <Badge variant="secondary">Test {selectedTest.id}</Badge>
          </CardTitle>
          <CardDescription>{selectedTest.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Raw JSON Display */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Mock Backend Response:</Label>
            <pre className="bg-muted p-4 rounded-lg text-xs overflow-x-auto">
              {JSON.stringify(selectedTest.data, null, 2)}
            </pre>
          </div>

          {/* Expected Alignments */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Expected Alignments:</Label>
            <div className="grid grid-cols-1 gap-2">
              {selectedTest.data.alignments.map((alignment, index) => (
                <div key={index} className="flex items-center gap-2 p-3 border rounded">
                  <span className="font-mono text-sm">{alignment.source}</span>
                  <span>→</span>
                  <span className="font-mono text-sm">{alignment.target}</span>
                  <div className="ml-auto flex items-center gap-2">
                    {alignment.refined && (
                      <Badge variant="outline" className="text-xs border-orange-300 text-orange-700">
                        LLM
                      </Badge>
                    )}
                    <Badge
                      variant={alignment.confidence > 0.7 ? "default" : "secondary"}
                    >
                      {Math.round(alignment.confidence * 100)}%
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Text Samples */}
          <div className="space-y-4">
            <div>
              <Label className="text-sm text-muted-foreground">Original (Persian)</Label>
              <p className="text-xl font-medium" dir="rtl">{selectedTest.data.original}</p>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">Translation (English)</Label>
              <p className="text-lg font-medium">{selectedTest.data.translation}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Alignment Visualization */}
      <Card>
        <CardHeader>
          <CardTitle>Visual Alignment Test</CardTitle>
          <CardDescription>
            Verify that multi-word phrases are highlighted as connected spans and arrows point correctly
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="p-6 border-2 border-dashed border-muted-foreground/20 rounded-lg bg-muted/10">
              <AlignmentViewer
                original={alignmentData.original}
                align={[]} // No aligneration for this test
                translation={alignmentData.translation}
                mappings={[]} // No traditional word mappings for this test
                phraseAlignments={alignmentData.phraseAlignments}
                directions={{
                  original: "rtl",
                  translation: "ltr"
                }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Verification Checklist */}
      <Card>
        <CardHeader>
          <CardTitle>Verification Checklist</CardTitle>
          <CardDescription>Visual verification points for alignment correctness</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 border-2 border-muted-foreground rounded flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Multi-word Target Highlighting</p>
                <p className="text-sm text-muted-foreground">
                  Phrases like "ice cream", "how are you", "with my family" should show as connected spans with special border styling
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 border-2 border-muted-foreground rounded flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Multi-word Source Highlighting</p>
                <p className="text-sm text-muted-foreground">
                  Persian phrases like "حالت چطوره", "با خانواده‌ام" should show as connected spans
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 border-2 border-muted-foreground rounded flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Arrow Positioning</p>
                <p className="text-sm text-muted-foreground">
                  Arrows should point from center of source phrase to center of target phrase (not just first word)
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 border-2 border-muted-foreground rounded flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Confidence-based Styling</p>
                <p className="text-sm text-muted-foreground">
                  High confidence (&gt;70%) should show blue highlighting, low confidence should show orange
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 border-2 border-muted-foreground rounded flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Hover Effects</p>
                <p className="text-sm text-muted-foreground">
                  Hovering any word in a phrase should highlight the entire phrase span and show the connecting arrow
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 border-2 border-muted-foreground rounded flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Tooltips</p>
                <p className="text-sm text-muted-foreground">
                  Tooltips should show full phrase text and confidence percentage
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 border-2 border-orange-300 rounded flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">LLM Refinement Indicators</p>
                <p className="text-sm text-muted-foreground">
                  Alignments with "refined: true" should show orange dashed borders and LLM badges to indicate AI enhancement
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 border-2 border-blue-300 rounded flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Span Embedding Enhancement</p>
                <p className="text-sm text-muted-foreground">
                  Multi-token spans with enhanced confidence (cases 8-9) should show solid blue highlighting
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 border-2 border-purple-300 rounded flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Trigger Pattern Verification</p>
                <p className="text-sm text-muted-foreground">
                  Test cases 5-7 and 10 should trigger different LLM patterns: partial collocations, multi→one, one→multi, and idiom detection
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 border-2 border-green-300 rounded flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Complex Scenario Integration</p>
                <p className="text-sm text-muted-foreground">
                  Test case 9 combines all features - verify collocations, span enhancement, and LLM refinement work together
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}