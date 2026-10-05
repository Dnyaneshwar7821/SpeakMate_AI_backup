import { useState, useEffect } from "react";
import { vocabularyService, progressService } from "../services/appServices";
import { speakGlobalText } from "../utils/speechHelper";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useToast } from "../context/ToastContext";
import { recordVocabularyMastered, recordWordAdded, recordQuizCompleted, recordWordDeleted } from "../utils/progressTracker";
import { SpeakMateLoader } from "../components/common/SpeakMateLoader";

// =========================================================================
// ONBOARDING CALIBRATED VOCABULARY CURRICULUMS (STUDENTS & INDIVIDUAL USERS)
// =========================================================================
const CURRICULUM_DATA = {
  // Students by Grade (1st to 10th Std)
  "1st Std": [
    { id: "v1_1", word: "Apple", partOfSpeech: "noun", meaning: "A sweet round fruit that grows on trees.", exampleSentence: "An apple a day keeps the doctor away.", synonym: "Fruit", favorite: true },
    { id: "v1_2", word: "Friend", partOfSpeech: "noun", meaning: "A person you like and enjoy spending time with.", exampleSentence: "Sita is my best school friend.", synonym: "Companion", favorite: false },
    { id: "v1_3", word: "Happy", partOfSpeech: "adjective", meaning: "Feeling or showing pleasure, contentment, and joy.", exampleSentence: "I feel very happy on my birthday.", synonym: "Joyful", favorite: false },
    { id: "v1_4", word: "Smile", partOfSpeech: "verb", meaning: "Form a pleased or happy facial expression.", exampleSentence: "Always smile when greeting your teacher.", synonym: "Beam", favorite: false },
    { id: "v1_5", word: "Sunny", partOfSpeech: "adjective", meaning: "Bright with sunlight and pleasant warm weather.", exampleSentence: "It is a sunny morning for playing outside.", synonym: "Bright", favorite: false },
    { id: "v1_6", word: "Puppy", partOfSpeech: "noun", meaning: "A young baby dog.", exampleSentence: "The playful puppy chased the red ball.", synonym: "Doggy", favorite: false },
  ],
  "2nd Std": [
    { id: "v2_1", word: "Routine", partOfSpeech: "noun", meaning: "A regular sequence of actions followed regularly.", exampleSentence: "Brushing teeth is part of my morning routine.", synonym: "Schedule", favorite: true },
    { id: "v2_2", word: "Pencil", partOfSpeech: "noun", meaning: "An instrument used for writing or drawing on paper.", exampleSentence: "I sharpened my yellow pencil for class.", synonym: "Writing tool", favorite: false },
    { id: "v2_3", word: "Weather", partOfSpeech: "noun", meaning: "The state of the atmosphere (sunny, rainy, cool).", exampleSentence: "The weather today is sunny and bright.", synonym: "Climate", favorite: false },
    { id: "v2_4", word: "Playground", partOfSpeech: "noun", meaning: "An outdoor area provided for children to play.", exampleSentence: "We play on the swings in the playground.", synonym: "Park", favorite: false },
    { id: "v2_5", word: "Gentle", partOfSpeech: "adjective", meaning: "Mild, kind, or tender in behavior.", exampleSentence: "Be gentle when holding the baby bird.", synonym: "Kind", favorite: false },
  ],
  "3rd Std": [
    { id: "v3_1", word: "Helper", partOfSpeech: "noun", meaning: "A person who helps or assists others in daily life.", exampleSentence: "Firefighters are brave community helpers.", synonym: "Assistant", favorite: true },
    { id: "v3_2", word: "Action", partOfSpeech: "noun", meaning: "The process of doing something or achieving an aim.", exampleSentence: "Running and jumping are active action words.", synonym: "Activity", favorite: false },
    { id: "v3_3", word: "Polite", partOfSpeech: "adjective", meaning: "Having or showing behavior that is respectful and considerate.", exampleSentence: "Saying please and thank you is very polite.", synonym: "Courteous", favorite: false },
    { id: "v3_4", word: "Schedule", partOfSpeech: "noun", meaning: "A plan that lists expected times for activities.", exampleSentence: "Check our school timetable schedule.", synonym: "Timetable", favorite: false },
    { id: "v3_5", word: "Curious", partOfSpeech: "adjective", meaning: "Eager to know or learn something new.", exampleSentence: "The curious student asked wonderful science questions.", synonym: "Inquisitive", favorite: false },
  ],
  "4th Std": [
    { id: "v4_1", word: "Expedition", partOfSpeech: "noun", meaning: "A journey undertaken by a group with a specific purpose.", exampleSentence: "Astronauts launched a space expedition to Mars.", synonym: "Journey", favorite: true },
    { id: "v4_2", word: "Direction", partOfSpeech: "noun", meaning: "The course along which someone or something moves.", exampleSentence: "Turn left to find the school library direction.", synonym: "Route", favorite: false },
    { id: "v4_3", word: "Habit", partOfSpeech: "noun", meaning: "A settled or regular tendency that is hard to give up.", exampleSentence: "Drinking clean water daily is a healthy habit.", synonym: "Practice", favorite: false },
    { id: "v4_4", word: "Courage", partOfSpeech: "noun", meaning: "Strength in the face of difficulty or danger.", exampleSentence: "It takes courage to speak clearly on stage.", synonym: "Bravery", favorite: false },
  ],
  "5th Std": [
    { id: "v5_1", word: "Environment", partOfSpeech: "noun", meaning: "The surroundings and nature in which humans and animals live.", exampleSentence: "Planting trees protects our natural environment.", synonym: "Surroundings", favorite: true },
    { id: "v5_2", word: "Experiment", partOfSpeech: "noun", meaning: "A scientific test done to discover something.", exampleSentence: "We conducted a science experiment on plant growth.", synonym: "Test", favorite: false },
    { id: "v5_3", word: "Recycle", partOfSpeech: "verb", meaning: "Convert waste materials into reusable objects.", exampleSentence: "We recycle paper and plastic bottles at school.", synonym: "Reuse", favorite: false },
    { id: "v5_4", word: "Discovery", partOfSpeech: "noun", meaning: "The act of finding something for the first time.", exampleSentence: "The scientist made an important medical discovery.", synonym: "Breakthrough", favorite: false },
  ],
  "6th Std": [
    { id: "v6_1", word: "Robotics", partOfSpeech: "noun", meaning: "The branch of engineering dealing with the design and use of robots.", exampleSentence: "She joined the school robotics club to build code.", synonym: "Automation", favorite: true },
    { id: "v6_2", word: "Debate", partOfSpeech: "noun", meaning: "A formal discussion on a particular topic in public.", exampleSentence: "Our team won the inter-school debate competition.", synonym: "Discussion", favorite: false },
    { id: "v6_3", word: "Assistance", partOfSpeech: "noun", meaning: "Help or support given to someone.", exampleSentence: "The teacher offered polite assistance during the test.", synonym: "Aid", favorite: false },
  ],
  "7th Std": [
    { id: "v7_1", word: "Conservation", partOfSpeech: "noun", meaning: "Prevention of wasteful use of a natural resource.", exampleSentence: "Water conservation is vital for future generations.", synonym: "Preservation", favorite: true },
    { id: "v7_2", word: "Delegate", partOfSpeech: "verb", meaning: "Entrust a task or duty to another person.", exampleSentence: "The leader delegates responsibilities to team members.", synonym: "Assign", favorite: false },
    { id: "v7_3", word: "Perspective", partOfSpeech: "noun", meaning: "A particular attitude toward or way of regarding something.", exampleSentence: "Reading history gives us a broader perspective on life.", synonym: "Viewpoint", favorite: false },
  ],
  "8th Std": [
    { id: "v8_1", word: "Leadership", partOfSpeech: "noun", meaning: "The action of leading a group or organization.", exampleSentence: "Student council develops strong leadership qualities.", synonym: "Guidance", favorite: true },
    { id: "v8_2", word: "Rebuttal", partOfSpeech: "noun", meaning: "A refutation or contradiction in a formal debate.", exampleSentence: "She delivered a powerful rebuttal during the debate.", synonym: "Refutation", favorite: false },
    { id: "v8_3", word: "Innovation", partOfSpeech: "noun", meaning: "A new method, idea, or technological product.", exampleSentence: "Artificial intelligence is a major technological innovation.", synonym: "Novelty", favorite: false },
  ],
  "9th Std": [
    { id: "v9_1", word: "Diplomatic", partOfSpeech: "adjective", meaning: "Handling sensitive situations tactfully and politely.", exampleSentence: "He used diplomatic language to resolve peer conflict.", synonym: "Tactful", favorite: true },
    { id: "v9_2", word: "Keynote", partOfSpeech: "noun", meaning: "A main speech outlining the central theme of an event.", exampleSentence: "She delivered the opening keynote on climate change.", synonym: "Main theme", favorite: false },
    { id: "v9_3", word: "Breakthrough", partOfSpeech: "noun", meaning: "A sudden, dramatic, and important discovery.", exampleSentence: "Scientists announced a breakthrough in solar energy.", synonym: "Advance", favorite: false },
  ],
  "10th Std": [
    { id: "v10_1", word: "Oratory", partOfSpeech: "noun", meaning: "Formal public speaking characterized by high eloquence.", exampleSentence: "CEFR C1 mastery requires spontaneous oratory skill.", synonym: "Eloquence", favorite: true },
    { id: "v10_2", word: "Simulation", partOfSpeech: "noun", meaning: "Imitation of a situation or process in realistic conditions.", exampleSentence: "We completed a 10th Board oral exam simulation.", synonym: "Model", favorite: false },
    { id: "v10_3", word: "Proficiency", partOfSpeech: "noun", meaning: "A high degree of skill, competence, and fluency.", exampleSentence: "Fluency and accuracy demonstrate English proficiency.", synonym: "Competence", favorite: false },
  ],

  // Individual Users by Age Group
  Kids: [
    { id: "vk_1", word: "Cheerful", partOfSpeech: "adjective", meaning: "Noticeably happy, energetic, and optimistic.", exampleSentence: "She greeted her classmates with a cheerful smile.", synonym: "Joyful", favorite: true },
    { id: "vk_2", word: "Adventure", partOfSpeech: "noun", meaning: "An unusual and exciting or daring experience.", exampleSentence: "We had a fun adventure in the treehouse.", synonym: "Journey", favorite: false },
    { id: "vk_3", word: "Playful", partOfSpeech: "adjective", meaning: "Fond of games and amusement; lighthearted.", exampleSentence: "The playful kitten jumped on the soft cushion.", synonym: "Frisky", favorite: false },
    { id: "vk_4", word: "Brave", partOfSpeech: "adjective", meaning: "Ready to face danger or pain without fear.", exampleSentence: "The brave knight protected the gentle animals.", synonym: "Courageous", favorite: false },
  ],
  Teens: [
    { id: "vt_1", word: "Relatable", partOfSpeech: "adjective", meaning: "Enabling a person to feel that they can identify with it.", exampleSentence: "The song lyrics are very relatable to teenagers.", synonym: "Understandable", favorite: true },
    { id: "vt_2", word: "Spontaneous", partOfSpeech: "adjective", meaning: "Performed or occurring as a result of a sudden impulse.", exampleSentence: "We took a spontaneous weekend bicycle trip.", synonym: "Unplanned", favorite: false },
    { id: "vt_3", word: "Collaborate", partOfSpeech: "verb", meaning: "Work jointly on an activity or creative project.", exampleSentence: "Our team collaborated to build the science project.", synonym: "Cooperate", favorite: false },
  ],
  "Young Adult": [
    { id: "vy_1", word: "Articulate", partOfSpeech: "adjective", meaning: "Having or showing the ability to speak fluently and coherently.", exampleSentence: "An articulate speaker can convey complex ideas effortlessly.", synonym: "Eloquent", favorite: true },
    { id: "vy_2", word: "Resilient", partOfSpeech: "adjective", meaning: "Able to withstand or recover quickly from difficulties.", exampleSentence: "She showed a resilient mindset throughout university.", synonym: "Tough", favorite: false },
    { id: "vy_3", word: "Pragmatic", partOfSpeech: "adjective", meaning: "Dealing with things sensibly and realistically in a practical way.", exampleSentence: "They took a pragmatic approach to budget planning.", synonym: "Practical", favorite: false },
    { id: "vy_4", word: "Tenacious", partOfSpeech: "adjective", meaning: "Tending to keep a firm hold of something; persistent.", exampleSentence: "Her tenacious effort helped her master English speaking.", synonym: "Persistent", favorite: false },
  ],
  Professional: [
    { id: "vw_1", word: "Strategic", partOfSpeech: "adjective", meaning: "Carefully designed or planned to serve a clear advantage.", exampleSentence: "We established strategic milestones for quarterly goals.", synonym: "Calculated", favorite: true },
    { id: "vw_2", word: "Leverage", partOfSpeech: "verb", meaning: "Use something to maximum advantage.", exampleSentence: "We leverage AI technology to accelerate English learning.", synonym: "Utilize", favorite: false },
    { id: "vw_3", word: "Synergy", partOfSpeech: "noun", meaning: "The combined effect of items greater than the sum of their individual effects.", exampleSentence: "Team synergy enabled us to deliver the project early.", synonym: "Harmony", favorite: false },
  ],
  Senior: [
    { id: "vs_1", word: "Serenity", partOfSpeech: "noun", meaning: "The state of being calm, peaceful, and untroubled.", exampleSentence: "She enjoyed the morning serenity of her garden.", synonym: "Tranquility", favorite: true },
    { id: "vs_2", word: "Nostalgia", partOfSpeech: "noun", meaning: "A sentimental longing or affection for the past.", exampleSentence: "Looking at old family photos brought a wave of nostalgia.", synonym: "Reminiscence", favorite: false },
    { id: "vs_3", word: "Wisdom", partOfSpeech: "noun", meaning: "The quality of having experience and sound judgment.", exampleSentence: "Her grandmother shared timeless wisdom on life and patience.", synonym: "Insight", favorite: false },
  ],
};

const DELETED_VOCAB_STORAGE_KEY = "speakmate_deleted_vocab_words";

const getDeletedVocabSet = () => {
  try {
    const raw = localStorage.getItem(DELETED_VOCAB_STORAGE_KEY);
    if (!raw) return new Set();
    const list = JSON.parse(raw);
    return new Set((Array.isArray(list) ? list : []).map((w) => String(w).toLowerCase().trim()));
  } catch {
    return new Set();
  }
};

const markVocabWordDeleted = (item) => {
  try {
    const raw = localStorage.getItem(DELETED_VOCAB_STORAGE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    const arr = Array.isArray(list) ? list : [];
    const wordKey = (item?.word || "").toLowerCase().trim();
    const idKey = String(item?.id || "").toLowerCase().trim();
    if (wordKey && !arr.includes(wordKey)) arr.push(wordKey);
    if (idKey && !arr.includes(idKey)) arr.push(idKey);
    localStorage.setItem(DELETED_VOCAB_STORAGE_KEY, JSON.stringify(arr));
  } catch {}
};

const unmarkVocabWordDeleted = (word) => {
  try {
    const raw = localStorage.getItem(DELETED_VOCAB_STORAGE_KEY);
    if (!raw) return;
    const list = JSON.parse(raw);
    const wordKey = (word || "").toLowerCase().trim();
    const nextList = (Array.isArray(list) ? list : []).filter((w) => String(w).toLowerCase().trim() !== wordKey);
    localStorage.setItem(DELETED_VOCAB_STORAGE_KEY, JSON.stringify(nextList));
  } catch {}
};

export function Vocabulary() {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState("list"); // 'list', 'flashcards', 'quiz'

  const getInitialCurated = () => {
    const savedAccType = user?.accountType || localStorage.getItem("speakmate_account_type") || "INDIVIDUAL_USER";
    const savedGrade = user?.schoolGrade || localStorage.getItem("speakmate_school_grade") || "1st Std";
    const savedAge = user?.ageGroup || localStorage.getItem("speakmate_age_group") || "Young Adult";

    let profileKey = "1st Std";
    if (savedAccType === "STUDENT" || Boolean(user?.isSchoolStudent)) {
      profileKey = savedGrade;
    } else {
      if (savedAge.toLowerCase().includes("kid")) profileKey = "Kids";
      else if (savedAge.toLowerCase().includes("teen")) profileKey = "Teens";
      else if (savedAge.toLowerCase().includes("senior")) profileKey = "Senior";
      else if (savedAge.toLowerCase().includes("pro") || savedAge.toLowerCase().includes("work")) profileKey = "Professional";
      else profileKey = "Young Adult";
    }
    const curated = CURRICULUM_DATA[profileKey] || CURRICULUM_DATA["1st Std"];
    const deletedSet = getDeletedVocabSet();
    return curated.filter(
      (w) => !deletedSet.has((w.word || "").toLowerCase().trim()) && !deletedSet.has(String(w.id || "").toLowerCase().trim())
    );
  };

  const [items, setItems] = useState(() => getInitialCurated(user));
  const [loading, setLoading] = useState(false);
  const [wordInput, setWordInput] = useState("");
  const [adding, setAdding] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [userProfileTitle, setUserProfileTitle] = useState("My Vocabulary");

  // 3D Flashcard State
  const [cardIndex, setCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  // Next-Level Quiz State
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [currentQuizIdx, setCurrentQuizIdx] = useState(0);
  const [selectedQuizAnswer, setSelectedQuizAnswer] = useState(null);
  const [quizScore, setQuizScore] = useState(0);
  const [streakCount, setStreakCount] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [quizFinished, setQuizFinished] = useState(false);
  const [earnedXP, setEarnedXP] = useState(0);
  const [mistakesList, setMistakesList] = useState([]);
  const [showMistakes, setShowMistakes] = useState(false);

  const loadVocabulary = async () => {
    try {
      const savedAccType = user?.accountType || localStorage.getItem("speakmate_account_type") || "INDIVIDUAL_USER";
      const savedGrade = user?.schoolGrade || localStorage.getItem("speakmate_school_grade") || "1st Std";
      const savedAge = user?.ageGroup || localStorage.getItem("speakmate_age_group") || "Young Adult";

      let profileKey = "1st Std";
      let title = "Vocabulary";

      if (savedAccType === "STUDENT" || Boolean(user?.isSchoolStudent)) {
        profileKey = savedGrade;
        title = `Student Standard: ${savedGrade}`;
      } else {
        if (savedAge.toLowerCase().includes("kid")) profileKey = "Kids";
        else if (savedAge.toLowerCase().includes("teen")) profileKey = "Teens";
        else if (savedAge.toLowerCase().includes("senior")) profileKey = "Senior";
        else if (savedAge.toLowerCase().includes("pro") || savedAge.toLowerCase().includes("work")) profileKey = "Professional";
        else profileKey = "Young Adult";
        title = `Age Group: ${savedAge}`;
      }

      setUserProfileTitle(title);

      const curatedBase = CURRICULUM_DATA[profileKey] || CURRICULUM_DATA["1st Std"];
      const backendWords = await vocabularyService.all().catch(() => []);

      const deletedSet = getDeletedVocabSet();

      const combined = [...(backendWords || [])];
      for (const cw of curatedBase) {
        if (!combined.some((w) => (w.word || "").toLowerCase() === (cw.word || "").toLowerCase())) {
          combined.push(cw);
        }
      }

      const activeWords = combined.filter((w) => {
        const wordKey = (w.word || "").toLowerCase().trim();
        const idKey = String(w.id || "").toLowerCase().trim();
        return !deletedSet.has(wordKey) && !deletedSet.has(idKey);
      });

      setItems(activeWords);
    } catch (e) {
      const curatedBase = CURRICULUM_DATA["1st Std"];
      const deletedSet = getDeletedVocabSet();
      setItems(curatedBase.filter((w) => !deletedSet.has((w.word || "").toLowerCase().trim())));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVocabulary(true);
    const handleRefresh = () => {
      loadVocabulary(false);
    };
    window.addEventListener("focus", handleRefresh);
    window.addEventListener("speakmate_progress_updated", handleRefresh);
    window.addEventListener("speakmate_settings_updated", handleRefresh);
    window.addEventListener("speakmate_age_group_changed", handleRefresh);
    return () => {
      window.removeEventListener("focus", handleRefresh);
      window.removeEventListener("speakmate_progress_updated", handleRefresh);
      window.removeEventListener("speakmate_settings_updated", handleRefresh);
      window.removeEventListener("speakmate_age_group_changed", handleRefresh);
    };
  }, [user?.ageGroup, user?.schoolGrade, user?.accountType]);

  const handleSpeak = (text) => {
    if (!text) return;
    speakGlobalText(text, 1.0);
  };

  // Play audio on initial card mount in Flashcards tab without flipping
  useEffect(() => {
    if (activeTab === "flashcards" && items.length > 0 && items[cardIndex] && !isFlipped) {
      handleSpeak(items[cardIndex].word);
    }
  }, [activeTab, cardIndex]);

  const filteredItems = items.filter((item) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      (item.word && item.word.toLowerCase().includes(q)) ||
      (item.meaning && item.meaning.toLowerCase().includes(q));

    const matchesFilter = filterType === "all" || (filterType === "favorites" && item.favorite);
    return matchesSearch && matchesFilter;
  });

  const currentCard = filteredItems[cardIndex] || filteredItems[0];

  const getPracticeCardFontSize = (word = "") => {
    const len = String(word || "").trim().length;
    if (len <= 8) return "text-3xl sm:text-4xl";
    if (len <= 13) return "text-2xl sm:text-3xl";
    if (len <= 18) return "text-xl sm:text-2xl";
    return "text-lg sm:text-xl";
  };

  const handleAddWord = async () => {
    const rawWord = wordInput.trim();
    if (!rawWord) return;

    // 1. Strict Duplicate Check: Never award XP for already added words
    const isDuplicate = items.some(
      (w) => (w.word || "").toLowerCase().trim() === rawWord.toLowerCase()
    );
    if (isDuplicate) {
      toast.warning(`"${rawWord}" is already in your vocabulary list!`);
      return;
    }

    // 2. Strict English Word Format & Lexical Validation
    const englishWordPattern = /^[A-Za-z]+([ -][A-Za-z]+)*$/;
    if (!englishWordPattern.test(rawWord) || rawWord.length < 2 || rawWord.length > 45) {
      toast.error(`"${rawWord}" is not a valid English word. SpeakMate AI accepts valid English words only (letters only, no numbers or special symbols).`);
      return;
    }

    // 3. Reject non-English words and greetings
    const nonEnglishWords = new Set([
      "bonjour", "hola", "gracias", "merci", "namaste", "ciao", "danke",
      "amigo", "arigato", "adios", "sayonara", "hallo", "shalom", "salam",
      "konnichiwa", "aloha", "chao", "oui", "si", "por favor", "s'il vous plait"
    ]);
    if (nonEnglishWords.has(rawWord.toLowerCase())) {
      toast.error(`🌍 "${rawWord}" is a non-English word. SpeakMate AI is dedicated to English language fluency. Please enter a valid English vocabulary word.`);
      return;
    }

    // 4. Prevent repeated character mashing (e.g. "aaaaaa", "zzzzzz")
    if (/([a-zA-Z])\1{3,}/.test(rawWord)) {
      toast.error(`"${rawWord}" appears to be random keyboard mashing. Please enter a meaningful English vocabulary word.`);
      return;
    }

    // 5. Catch consonant-only meaningless strings (words of 3+ letters without any vowels)
    if (rawWord.length >= 3 && !/[aeiouy]/i.test(rawWord)) {
      toast.error(`"${rawWord}" does not appear to be a recognized English word. Please enter a meaningful English vocabulary word.`);
      return;
    }

    setAdding(true);
    try {
      // 6. Call backend vocabulary service (validates via AI & DB)
      const res = await vocabularyService.add(rawWord);
      if (!res || !res.word) {
        throw new Error("Unable to verify word definition.");
      }

      unmarkVocabWordDeleted(rawWord);
      setWordInput("");
      setItems((prev) => [res, ...prev.filter((w) => (w.word || "").toLowerCase().trim() !== rawWord.toLowerCase())]);

      // Award XP ONLY upon successful, confirmed valid English addition
      recordWordAdded(1, user);
      toast.success(`"${res.word}" added with AI definition! (+5 XP ✨)`);
    } catch (e) {
      const serverMsg = e.response?.data?.message || e.message || "";
      const status = e.response?.status;

      // If backend explicitly rejected with validation or tutor explanation:
      if (status === 400 || (serverMsg && (
        serverMsg.toLowerCase().includes("not a valid") ||
        serverMsg.toLowerCase().includes("already in your") ||
        serverMsg.toLowerCase().includes("keyboard mashing") ||
        serverMsg.toLowerCase().includes("cannot be added") ||
        serverMsg.toLowerCase().includes("not recognized") ||
        serverMsg.toLowerCase().includes("foreign") ||
        serverMsg.toLowerCase().includes("different language")
      ))) {
        toast.error(`🔍 ${serverMsg || `"${rawWord}" is not accepted as a valid English word.`}`);
        return;
      }

      // If backend was unreachable or had server error, fallback to verifying with public English Dictionary API:
      try {
        const dictRes = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(rawWord)}`);
        if (dictRes.ok) {
          const dictData = await dictRes.json();
          if (Array.isArray(dictData) && dictData.length > 0) {
            const entry = dictData[0];
            const meaningObj = entry.meanings?.[0];
            const defObj = meaningObj?.definitions?.[0];
            const verifiedItem = {
              id: "loc_" + Date.now(),
              word: entry.word || rawWord,
              partOfSpeech: meaningObj?.partOfSpeech || "word",
              phonetic: entry.phonetic || entry.phonetics?.[0]?.text || "",
              meaning: defObj?.definition || `Definition for ${rawWord}`,
              exampleSentence: defObj?.example || `Practice using "${rawWord}" in daily English.`,
              synonym: defObj?.synonyms?.[0] || meaningObj?.synonyms?.[0] || "None",
              favorite: false,
              mastered: false,
            };
            unmarkVocabWordDeleted(rawWord);
            setWordInput("");
            setItems((prev) => [verifiedItem, ...prev.filter((w) => (w.word || "").toLowerCase().trim() !== rawWord.toLowerCase())]);
            recordWordAdded(1, user);
            toast.success(`"${verifiedItem.word}" verified and added to your vocabulary! (+5 XP ✨)`);
            return;
          }
        }
      } catch (_) {}

      // If neither the backend nor the dictionary API recognized it as valid English:
      // REJECT and award strictly 0 XP!
      toast.error(`"${rawWord}" is not recognized in English dictionaries. SpeakMate AI is dedicated to English language fluency. Please enter a valid English vocabulary word.`);
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteWord = async (item, e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    if (!item) return;

    const wordName = item.word || "Word";

    // 1. Remove from local items state immediately for instantaneous, fluid UX
    setItems((prev) =>
      prev.filter((w) => {
        const sameId = w.id && item.id && String(w.id) === String(item.id);
        const sameWord = w.word && item.word && (w.word || "").toLowerCase().trim() === (item.word || "").toLowerCase().trim();
        return !sameId && !sameWord;
      })
    );

    // 2. Blacklist in localStorage so curated base won't restore it on next reload
    markVocabWordDeleted(item);

    // 3. Decrement user vocabulary stats
    recordWordDeleted(1, user);

    // 4. Adjust card index if user is currently on flashcards
    setCardIndex((prev) => Math.max(0, prev > 0 ? prev - 1 : 0));

    // 5. Call backend if id exists and is not a static local curated id
    if (item.id && (typeof item.id === "number" || !String(item.id).startsWith("v"))) {
      vocabularyService.remove(item.id).catch(() => {});
    }

    toast.success(`"${wordName}" removed from your vocabulary.`);
  };

  const handleMasterWord = async (item) => {
    try {
      if (typeof item.id === "number" || !String(item.id).startsWith("v")) {
        await vocabularyService.toggleMastered(item.id);
      }
      const updated = !item.mastered;
      setItems((prev) => prev.map((w) => (w.id === item.id ? { ...w, mastered: updated } : w)));
      if (updated) {
        recordVocabularyMastered(1);
        toast.success(`Word "${item.word}" marked as Mastered! 🧠`);
      }
    } catch (e) {
      const updated = !item.mastered;
      setItems((prev) => prev.map((w) => (w.id === item.id ? { ...w, mastered: updated } : w)));
      if (updated) {
        recordVocabularyMastered(1);
        toast.success(`Word "${item.word}" marked as Mastered! 🧠`);
      }
    }
  };

  const toggleFavorite = async (item) => {
    try {
      if (typeof item.id === "number" || !String(item.id).startsWith("v")) {
        await vocabularyService.toggleFavorite(item.id);
      }
      const updated = !item.favorite;
      setItems((prev) => prev.map((w) => (w.id === item.id ? { ...w, favorite: updated } : w)));
    } catch (e) {
      setItems((prev) => prev.map((w) => (w.id === item.id ? { ...w, favorite: !item.favorite } : w)));
    }
  };

  // 3D Flashcard Flip & Automatic Audio + Mastering
  const handleCardClick = () => {
    const nextFlipped = !isFlipped;
    setIsFlipped(nextFlipped);
    if (nextFlipped && currentCard) {
      // Tapping front card -> flips to back and AI speaks the meaning!
      handleSpeak(currentCard.meaning ? `${currentCard.word}. ${currentCard.meaning}` : currentCard.word);
      // Automatically master the word when user flips to see and listen to the meaning!
      if (!currentCard.mastered) {
        handleMasterWord(currentCard);
      }
    } else if (!nextFlipped && currentCard) {
      // Tapping back card -> speaks the word again as it turns back to front
      handleSpeak(currentCard.word);
    }
  };

  const handleSpeakerClick = (e, isBackSide = false) => {
    if (e && e.stopPropagation) e.stopPropagation();
    if (currentCard) {
      if (isBackSide) {
        handleSpeak(currentCard.meaning ? `${currentCard.word}. ${currentCard.meaning}` : currentCard.word);
        if (!currentCard.mastered) {
          handleMasterWord(currentCard);
        }
      } else {
        handleSpeak(currentCard.word);
      }
    }
  };

  // Next-Level Multi-Format High-Accuracy Quiz
  const startQuiz = () => {
    setCurrentQuizIdx(0);
    setSelectedQuizAnswer(null);
    setQuizScore(0);
    setStreakCount(0);
    setMaxStreak(0);
    setQuizFinished(false);
    setMistakesList([]);
    setShowMistakes(false);
    setEarnedXP(0);

    const deletedSet = getDeletedVocabSet();
    const allPools = [
      ...items,
      ...CURRICULUM_DATA["1st Std"],
      ...CURRICULUM_DATA["3rd Std"],
      ...CURRICULUM_DATA["5th Std"],
      ...CURRICULUM_DATA["7th Std"],
      ...CURRICULUM_DATA["10th Std"],
      ...CURRICULUM_DATA["Young Adult"],
      ...CURRICULUM_DATA["Professional"],
    ];

    const uniquePool = [];
    const seenWords = new Set();
    for (const w of allPools) {
      const wKey = (w.word || "").toLowerCase().trim();
      if (wKey && !seenWords.has(wKey) && !deletedSet.has(wKey)) {
        seenWords.add(wKey);
        uniquePool.push(w);
      }
    }

    const activePool = items.length >= 5 ? items : uniquePool;
    const shuffledActive = [...activePool].sort(() => 0.5 - Math.random());
    const selectedTargets = shuffledActive.slice(0, 5);

    const questions = selectedTargets.map((item, idx) => {
      const qType = idx % 4;
      let questionBadge = "";
      let promptTitle = "";
      let promptSubtitle = "";
      let correctAnswer = "";
      let options = [];

      if (qType === 0 && item.exampleSentence) {
        questionBadge = "📝 Sentence Context";
        const regex = new RegExp(`\\b${item.word}\\b`, "gi");
        promptTitle = item.exampleSentence.replace(regex, "_______");
        promptSubtitle = "Choose the correct word to complete the sentence:";
        correctAnswer = item.word;

        const otherWords = uniquePool
          .filter((w) => w.word.toLowerCase() !== item.word.toLowerCase())
          .map((w) => w.word)
          .sort(() => 0.5 - Math.random())
          .slice(0, 3);

        options = [item.word, ...otherWords].sort(() => 0.5 - Math.random());
      } else if (qType === 1 && item.synonym && item.synonym !== "None" && item.synonym !== "Fruit") {
        questionBadge = "🔀 Synonym Finder";
        promptTitle = `Which word is the closest synonym for "${item.word}"?`;
        promptSubtitle = "Select the word with the most similar meaning:";
        correctAnswer = item.synonym;

        const otherSynonyms = uniquePool
          .filter((w) => w.synonym && w.synonym !== "None" && w.synonym.toLowerCase() !== item.synonym.toLowerCase())
          .map((w) => w.synonym)
          .sort(() => 0.5 - Math.random())
          .slice(0, 3);

        while (otherSynonyms.length < 3) {
          otherSynonyms.push(["Hesitation", "Confusion", "Disruption", "Hesitant"][otherSynonyms.length]);
        }

        options = [item.synonym, ...otherSynonyms].sort(() => 0.5 - Math.random());
      } else if (qType === 2) {
        questionBadge = "🔊 Listening Comprehension";
        promptTitle = `Listen to the pronunciation of "${item.word}"`;
        promptSubtitle = "What is the accurate definition of this word?";
        correctAnswer = item.meaning;

        const otherMeanings = uniquePool
          .filter((w) => w.meaning && w.meaning !== item.meaning)
          .map((w) => w.meaning)
          .sort(() => 0.5 - Math.random())
          .slice(0, 3);

        options = [item.meaning, ...otherMeanings].sort(() => 0.5 - Math.random());
      } else {
        questionBadge = "📖 Definition Match";
        promptTitle = `What is the correct definition of "${item.word}"?`;
        promptSubtitle = "Choose the precise meaning:";
        correctAnswer = item.meaning;

        const otherMeanings = uniquePool
          .filter((w) => w.meaning && w.meaning !== item.meaning)
          .map((w) => w.meaning)
          .sort(() => 0.5 - Math.random())
          .slice(0, 3);

        options = [item.meaning, ...otherMeanings].sort(() => 0.5 - Math.random());
      }

      return {
        id: `q_${idx}_${Date.now()}`,
        questionBadge,
        promptTitle,
        promptSubtitle,
        targetWord: item.word,
        correctAnswer,
        options,
        exampleSentence: item.exampleSentence,
        meaning: item.meaning,
      };
    });

    setQuizQuestions(questions);
    setActiveTab("quiz");
  };

  const submitQuizAnswer = (opt) => {
    if (selectedQuizAnswer !== null) return;
    setSelectedQuizAnswer(opt);
    const currentQ = quizQuestions[currentQuizIdx];
    const isCorrect = opt === currentQ.correctAnswer;

    if (isCorrect) {
      setQuizScore((prev) => prev + 1);
      const newStreak = streakCount + 1;
      setStreakCount(newStreak);
      if (newStreak > maxStreak) setMaxStreak(newStreak);
    } else {
      setStreakCount(0);
      setMistakesList((prev) => [...prev, { ...currentQ, userAnswer: opt }]);
    }
  };

  const finishQuiz = async () => {
    setQuizFinished(true);
    const totalQ = quizQuestions.length;
    const baseXP = quizScore * 5;
    const perfectBonus = quizScore === totalQ && totalQ > 0 ? 10 : 0;
    const totalAwarded = baseXP + perfectBonus;
    setEarnedXP(totalAwarded);

    recordQuizCompleted("vocabulary", quizScore, totalQ);

    try {
      const prog = await progressService.get().catch(() => null);
      if (prog) {
        await progressService.update({
          ...prog,
          xp: (prog.xp || 0) + totalAwarded,
          totalVocabularyWords: (prog.totalVocabularyWords || 0) + quizScore,
        });
      }
    } catch (e) {
      console.warn("Quiz progress update error:", e);
    }
  };

  const nextQuizQuestion = () => {
    if (currentQuizIdx < quizQuestions.length - 1) {
      setSelectedQuizAnswer(null);
      setCurrentQuizIdx((prev) => prev + 1);
    } else {
      finishQuiz();
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-[var(--text-primary)] flex items-center gap-3">
            <span className="p-2.5 rounded-2xl bg-indigo-500/15 text-[#6C63FF] text-2xl shadow-sm">
              📚
            </span>
            Vocabulary Builder
          </h1>
          <p className="text-[var(--text-secondary)] mt-1 font-semibold text-sm">
            {userProfileTitle} • Interactive Practice Cards & AI Quizzes
          </p>
        </div>

        {/* Tab Controls */}
        <div className="flex bg-[var(--bg-elevated)] p-1.5 rounded-2xl border border-[var(--border-default)] w-fit shadow-inner">
          <button
            onClick={() => setActiveTab("list")}
            className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${
              activeTab === "list"
                ? "bg-[var(--bg-surface)] text-[#6C63FF] shadow-md border border-[var(--border-default)]"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            📖 Word Bank
          </button>
          <button
            onClick={() => {
              if (!filteredItems.length) {
                toast.warning("Please add vocabulary words to start practice cards.");
                return;
              }
              setCardIndex(0);
              setIsFlipped(false);
              setActiveTab("flashcards");
            }}
            className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${
              activeTab === "flashcards"
                ? "bg-[var(--bg-surface)] text-[#6C63FF] shadow-md border border-[var(--border-default)]"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            🎴 Practice Cards
          </button>
          <button
            onClick={startQuiz}
            className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${
              activeTab === "quiz"
                ? "bg-[var(--bg-surface)] text-[#6C63FF] shadow-md border border-[var(--border-default)]"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            🏆 AI Quiz
          </button>
        </div>
      </div>

      {/* =========================================================================
          TAB 1: MY LIST (WORD BANK WITH SAMPLE EXAMPLES & FAVORITE STARS)
      ========================================================================= */}
      {activeTab === "list" && (
        <div className="space-y-6">
          {/* Add Word Box */}
          <div className="bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 border border-indigo-500/30 rounded-3xl p-6 shadow-sm">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-lg font-extrabold text-[var(--text-primary)] flex items-center gap-2">
                ✨ AI Word Lookup & Add
              </h2>
              <span className="bg-emerald-500 text-white text-xs font-black px-3 py-1 rounded-full shadow-sm">+5 XP</span>
            </div>
            <p className="text-sm text-[var(--text-secondary)] mb-4 font-medium">
              Type any English word. SpeakMate AI automatically extracts meaning, part of speech, and examples.
            </p>
            <div className="flex gap-3">
              <input
                type="text"
                placeholder="e.g. Eloquent, Resilient, Articulate..."
                value={wordInput}
                onChange={(e) => setWordInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddWord()}
                className="flex-1 bg-[var(--bg-surface)] border border-[var(--border-default)] px-4 py-3 rounded-2xl text-sm font-semibold text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
              />
              <button
                onClick={handleAddWord}
                disabled={adding}
                className="px-6 py-3 bg-[#6C63FF] hover:bg-indigo-700 text-white font-bold rounded-2xl transition-all shadow-md shadow-indigo-600/30 disabled:opacity-50 flex items-center gap-2"
              >
                {adding ? "Analyzing..." : "Add Word ✨"}
              </button>
            </div>
          </div>

          {/* Search & Filter */}
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="relative w-full sm:w-80">
              <input
                type="text"
                placeholder="Search words, meanings..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[var(--bg-surface)] border border-[var(--border-default)] pl-10 pr-4 py-2.5 rounded-2xl text-sm font-medium text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
              />
              <span className="absolute left-3.5 top-3 text-[var(--text-secondary)] text-sm">🔍</span>
            </div>

            <div className="flex gap-2">
              {[
                { key: "all", label: loading ? "All Words (...)" : `All Words (${items.length})` },
                { key: "favorites", label: "⭐ Favorites" },
              ].map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilterType(f.key)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm ${
                    filterType === f.key
                      ? "bg-[#6C63FF] text-white shadow-sm"
                      : "bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-default)]"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Word Cards Grid with Favorite Stars */}
          {filteredItems.length === 0 ? (
            <div className="text-center py-16 bg-[var(--bg-surface)] border border-dashed border-[var(--border-default)] rounded-3xl shadow-sm">
              <span className="text-4xl mb-3 block">📖</span>
              <h3 className="text-lg font-bold text-[var(--text-primary)]">No Words Found</h3>
              <p className="text-sm text-[var(--text-secondary)] max-w-sm mx-auto mt-1 font-medium">
                Add custom words above using the AI word lookup bar!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredItems.map((item, idx) => (
                <div
                  key={item.id || idx}
                  className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-3xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between min-w-0 overflow-hidden"
                >
                  <div className="min-w-0">
                    <div className="flex justify-between items-start mb-3 gap-2">
                      <div className="min-w-0 flex-1 pr-1">
                        <div className="flex items-center gap-2 flex-wrap min-w-0">
                          <h3 className="text-xl font-black text-[var(--text-primary)] break-words [overflow-wrap:anywhere] min-w-0 leading-tight">
                            {item.word}
                          </h3>
                          {item.partOfSpeech && (
                            <span className="bg-indigo-500/15 text-[#6C63FF] text-[10px] uppercase font-black px-2 py-0.5 rounded-md border border-indigo-500/20 flex-shrink-0">
                              {item.partOfSpeech}
                            </span>
                          )}
                          {item.mastered && (
                            <span className="bg-emerald-500/15 text-emerald-500 text-[10px] uppercase font-bold px-1.5 py-0.5 rounded border border-emerald-500/20 flex-shrink-0">
                              ✓
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => handleSpeak(item.word)}
                          className="w-8 h-8 rounded-xl bg-[var(--bg-elevated)] text-[#6C63FF] flex items-center justify-center hover:scale-105 transition-all text-sm shadow-sm border border-[var(--border-default)] flex-shrink-0"
                          title="Listen Pronunciation"
                        >
                          🔊
                        </button>
                        <button
                          onClick={() => toggleFavorite(item)}
                          className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-500 flex items-center justify-center hover:scale-105 transition-all text-base shadow-sm border border-amber-500/20 flex-shrink-0"
                          title="Toggle Favorite"
                        >
                          {item.favorite ? "⭐" : "☆"}
                        </button>
                        <button
                          onClick={(e) => handleDeleteWord(item, e)}
                          className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 hover:text-rose-600 flex items-center justify-center hover:scale-105 transition-all text-xs shadow-sm border border-rose-500/20 flex-shrink-0"
                          title="Delete Word"
                          aria-label={`Delete ${item.word}`}
                        >
                          <svg
                            className="w-3.5 h-3.5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>

                    <p className="text-sm text-[var(--text-primary)] font-semibold mb-3 leading-relaxed break-words [overflow-wrap:anywhere]">
                      {item.meaning}
                    </p>

                    {item.exampleSentence && (
                      <div className="bg-[var(--bg-elevated)] p-3 rounded-2xl border border-[var(--border-default)] mb-3 text-xs text-[var(--text-secondary)] italic font-medium break-words [overflow-wrap:anywhere]">
                        "{item.exampleSentence}"
                      </div>
                    )}
                  </div>

                  {item.synonym && item.synonym !== "None" && (
                    <div className="pt-2.5 border-t border-[var(--border-default)] text-xs">
                      <p className="text-[var(--text-secondary)]">
                        <span className="font-bold text-[var(--text-primary)]">Synonym: </span>
                        <span className="text-emerald-500 font-semibold">{item.synonym}</span>
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 2: 3D FLASHCARDS (WORD -> TAP -> SPEAKS MEANING & FLIPS)
      ========================================================================= */}
      {activeTab === "flashcards" && currentCard && (
        <div className="max-w-xl mx-auto space-y-6">
          <div className="flex justify-between items-center text-sm font-bold text-[var(--text-secondary)]">
            <span className="bg-indigo-500/15 text-[#6C63FF] px-3 py-1 rounded-xl font-extrabold text-xs border border-indigo-500/20">
              CARD {cardIndex + 1} OF {filteredItems.length}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => toggleFavorite(currentCard)}
                className="text-2xl hover:scale-110 transition-all p-1 text-amber-500"
                title="Toggle Favorite"
              >
                {currentCard.favorite ? "⭐" : "☆"}
              </button>
              <button
                onClick={(e) => handleDeleteWord(currentCard, e)}
                className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 hover:text-rose-600 flex items-center justify-center hover:scale-105 transition-all text-xs border border-rose-500/20 shadow-sm"
                title="Delete Word"
                aria-label={`Delete ${currentCard.word}`}
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-[var(--bg-elevated)] h-2.5 rounded-full overflow-hidden border border-[var(--border-default)]">
            <div
              className="bg-[#6C63FF] h-full rounded-full transition-all duration-300"
              style={{ width: `${((cardIndex + 1) / filteredItems.length) * 100}%` }}
            />
          </div>

          {/* Realistic 3D Flip Card Container */}
          <div
            style={{ perspective: "1000px" }}
            className="w-full h-[370px] cursor-pointer select-none"
            onClick={handleCardClick}
          >
            <div
              style={{
                transformStyle: "preserve-3d",
                transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
                transition: "transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)",
              }}
              className="w-full h-full relative"
            >
              {/* FRONT OF CARD (WORD ONLY - RESPONSIVE CONTAINMENT) */}
              <div
                style={{ backfaceVisibility: "hidden" }}
                className="absolute inset-0 w-full h-full bg-[var(--bg-surface)] border-2 border-indigo-500/30 rounded-3xl p-5 sm:p-8 shadow-xl flex flex-col justify-between overflow-hidden"
              >
                <div className="flex justify-between items-center gap-2">
                  <span className="bg-indigo-500/15 text-[#6C63FF] text-xs uppercase font-black px-3 py-1 rounded-lg border border-indigo-500/20 flex-shrink-0">
                    {currentCard.partOfSpeech || "Vocabulary Word"}
                  </span>
                  <div className="flex items-center gap-2">
                    {currentCard.mastered && (
                      <span className="bg-emerald-500/15 text-emerald-500 text-[10px] uppercase font-black px-2.5 py-1 rounded-lg border border-emerald-500/20 flex items-center gap-1 shadow-sm flex-shrink-0">
                        <span>✓</span> Mastered
                      </span>
                    )}
                    <button
                      onClick={(e) => handleSpeakerClick(e, false)}
                      className="w-10 h-10 rounded-full bg-[#6C63FF] text-white flex items-center justify-center shadow-md shadow-indigo-600/30 hover:scale-105 transition-all text-sm flex-shrink-0"
                      title="Play Pronunciation"
                    >
                      🔊
                    </button>
                  </div>
                </div>

                <div className="text-center my-auto space-y-2 w-full px-2 min-w-0 max-w-full">
                  <h2 className={`font-black text-[var(--text-primary)] tracking-tight break-words [overflow-wrap:anywhere] max-w-full leading-tight ${getPracticeCardFontSize(currentCard.word)}`}>
                    {currentCard.word}
                  </h2>
                </div>

                <div className="text-center text-xs font-bold text-[var(--text-secondary)] bg-[var(--bg-elevated)] py-2 rounded-xl border border-[var(--border-default)] flex items-center justify-center gap-2">
                  <span className="text-[#6C63FF]">🔄</span> Tap card to reveal meaning & master
                </div>
              </div>

              {/* BACK OF CARD (MEANING + EXAMPLES - RESPONSIVE CONTAINMENT) */}
              <div
                style={{
                  backfaceVisibility: "hidden",
                  transform: "rotateY(180deg)",
                }}
                className="absolute inset-0 w-full h-full bg-[var(--bg-surface)] border-2 border-indigo-500/30 rounded-3xl p-5 sm:p-8 shadow-xl flex flex-col justify-between overflow-hidden"
              >
                <div className="flex justify-between items-center gap-3 min-w-0">
                  <div className="flex items-center gap-2 min-w-0 flex-1 flex-wrap sm:flex-nowrap">
                    <span className="text-base sm:text-lg font-black text-[#6C63FF] break-words [overflow-wrap:anywhere] min-w-0">
                      {currentCard.word}
                    </span>
                    {currentCard.partOfSpeech && (
                      <span className="bg-indigo-500/15 text-[#6C63FF] text-[10px] uppercase font-bold px-2 py-0.5 rounded-md border border-indigo-500/20 flex-shrink-0">
                        {currentCard.partOfSpeech}
                      </span>
                    )}
                    {currentCard.mastered && (
                      <span className="bg-emerald-500/15 text-emerald-500 text-[10px] uppercase font-black px-2 py-0.5 rounded-md border border-emerald-500/20 flex-shrink-0">
                        ✓ Mastered
                      </span>
                    )}
                  </div>
                  <button
                    onClick={(e) => handleSpeakerClick(e, true)}
                    className="w-10 h-10 rounded-full bg-[#6C63FF] text-white flex items-center justify-center shadow-md shadow-indigo-600/30 hover:scale-105 transition-all text-sm flex-shrink-0"
                    title="Play Meaning Audio"
                  >
                    🔊
                  </button>
                </div>

                <div className="my-auto space-y-3 text-left overflow-y-auto max-h-[220px] pr-1">
                  <div className="bg-[var(--bg-elevated)] p-4 rounded-2xl border border-[var(--border-default)]">
                    <p className="text-[11px] uppercase font-black text-[#6C63FF] mb-1 flex items-center gap-1.5">
                      <span>📖</span> MEANING & DEFINITION
                    </p>
                    <p className="text-base font-bold text-[var(--text-primary)] leading-relaxed">
                      {currentCard.meaning}
                    </p>
                  </div>

                  {currentCard.exampleSentence && (
                    <div className="bg-indigo-500/10 p-3.5 rounded-2xl border border-indigo-500/20">
                      <p className="text-[11px] uppercase font-black text-[#6C63FF] mb-1 flex items-center gap-1.5">
                        <span>💬</span> EXAMPLE IN CONTEXT
                      </p>
                      <p className="text-xs italic text-[var(--text-primary)] font-medium">
                        "{currentCard.exampleSentence}"
                      </p>
                    </div>
                  )}

                  {currentCard.synonym && currentCard.synonym !== "None" && (
                    <div className="bg-emerald-500/15 px-3 py-2 rounded-xl border border-emerald-500/20 text-xs text-emerald-600 dark:text-emerald-300 font-medium">
                      🌿 <span className="font-bold">Synonym:</span> {currentCard.synonym}
                    </div>
                  )}
                </div>

                <div className="text-center text-xs font-bold text-[var(--text-secondary)] bg-[var(--bg-elevated)] py-2 rounded-xl border border-[var(--border-default)] flex items-center justify-center gap-2">
                  <span className="text-[#6C63FF]">🔄</span> Tap card to hear word & flip back
                </div>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex justify-between items-center pt-2">
            <button
              onClick={() => {
                setIsFlipped(false);
                setCardIndex((prev) => (prev - 1 + filteredItems.length) % filteredItems.length);
              }}
              className="px-6 py-3 bg-[var(--bg-surface)] font-bold text-[var(--text-primary)] rounded-2xl hover:bg-[var(--bg-elevated)] transition-all border border-[var(--border-default)] shadow-sm"
            >
              ← Previous
            </button>
            <button
              onClick={() => {
                setIsFlipped(false);
                setCardIndex((prev) => (prev + 1) % filteredItems.length);
              }}
              className="px-6 py-3 bg-[#6C63FF] font-bold text-white rounded-2xl hover:bg-indigo-700 transition-all shadow-md shadow-indigo-600/30"
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 3: NEXT-LEVEL MULTI-FORMAT HIGH-ACCURACY AI QUIZ
      ========================================================================= */}
      {activeTab === "quiz" && (
        <div className="max-w-xl mx-auto space-y-6">
          {!quizFinished && quizQuestions.length > 0 && (
            <div className="space-y-6">
              <div className="flex justify-between items-center text-sm font-bold">
                <span className="text-[var(--text-secondary)] font-extrabold text-xs">
                  QUESTION {currentQuizIdx + 1} OF {quizQuestions.length}
                </span>
                <div className="flex items-center gap-3">
                  {streakCount >= 2 && (
                    <span className="bg-amber-500/15 text-amber-500 text-xs font-black px-3 py-1 rounded-full border border-amber-500/20 shadow-sm">
                      🔥 {streakCount} Streak!
                    </span>
                  )}
                  <span className="text-[#6C63FF] font-black">
                    Score: {quizScore} / {quizQuestions.length}
                  </span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-[var(--bg-elevated)] h-2.5 rounded-full overflow-hidden border border-[var(--border-default)]">
                <div
                  className="bg-[#6C63FF] h-full rounded-full transition-all duration-300"
                  style={{ width: `${((currentQuizIdx + 1) / quizQuestions.length) * 100}%` }}
                />
              </div>

              {/* Question Card */}
              <div className="bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 border border-indigo-500/25 rounded-3xl p-6 shadow-sm space-y-3">
                <div className="flex justify-between items-center">
                  <span className="bg-[#6C63FF] text-white text-xs uppercase font-extrabold px-3 py-1 rounded-lg shadow-sm">
                    {quizQuestions[currentQuizIdx]?.questionBadge}
                  </span>
                  <button
                    onClick={() => handleSpeak(quizQuestions[currentQuizIdx]?.promptTitle)}
                    className="p-2 bg-[#6C63FF] text-white rounded-full hover:scale-110 transition-all text-xs shadow-sm"
                  >
                    🔊
                  </button>
                </div>
                <h2 className="text-xl font-extrabold text-[var(--text-primary)] leading-snug">
                  {quizQuestions[currentQuizIdx]?.promptTitle}
                </h2>
                {quizQuestions[currentQuizIdx]?.promptSubtitle && (
                  <p className="text-xs text-[#6C63FF] font-semibold">
                    {quizQuestions[currentQuizIdx]?.promptSubtitle}
                  </p>
                )}
              </div>

              {/* Options */}
              <div className="space-y-3">
                {quizQuestions[currentQuizIdx]?.options.map((opt, i) => {
                  const isSel = selectedQuizAnswer === opt;
                  const isCorrect = opt === quizQuestions[currentQuizIdx]?.correctAnswer;
                  let btnClass = "bg-[var(--bg-surface)] border-[var(--border-default)] text-[var(--text-primary)] hover:border-[#6C63FF]";

                  if (selectedQuizAnswer !== null) {
                    if (isCorrect) {
                      btnClass = "bg-emerald-500/15 border-emerald-500 text-emerald-600 font-bold";
                    } else if (isSel && !isCorrect) {
                      btnClass = "bg-rose-500/15 border-rose-500 text-rose-600 font-bold";
                    }
                  }

                  return (
                    <button
                      key={i}
                      disabled={selectedQuizAnswer !== null}
                      onClick={() => submitQuizAnswer(opt)}
                      className={`w-full p-4 rounded-2xl border-2 text-left text-sm font-semibold transition-all flex items-center gap-3 shadow-sm ${btnClass}`}
                    >
                      <span className="w-7 h-7 rounded-xl bg-indigo-500/15 text-[#6C63FF] font-black flex items-center justify-center text-xs">
                        {String.fromCharCode(65 + i)}
                      </span>
                      <span className="flex-1">{opt}</span>
                    </button>
                  );
                })}
              </div>

              {/* Explanation Card */}
              {selectedQuizAnswer !== null && (
                <div className="bg-[var(--bg-elevated)] border border-[var(--border-default)] p-4 rounded-2xl text-xs space-y-1.5 shadow-sm">
                  <p className="font-extrabold text-[#6C63FF]">💡 Context & Meaning:</p>
                  <p className="text-[var(--text-primary)] font-semibold">
                    <strong className="text-[var(--text-primary)] font-black">{quizQuestions[currentQuizIdx]?.targetWord}:</strong> {quizQuestions[currentQuizIdx]?.meaning}
                  </p>
                  {quizQuestions[currentQuizIdx]?.exampleSentence && (
                    <p className="italic text-[var(--text-secondary)] font-medium">
                      "{quizQuestions[currentQuizIdx]?.exampleSentence}"
                    </p>
                  )}
                </div>
              )}

              {/* Next Question */}
              {selectedQuizAnswer !== null && (
                <button
                  onClick={nextQuizQuestion}
                  className="w-full py-4 bg-[#6C63FF] hover:bg-indigo-700 text-white font-extrabold rounded-2xl transition-all shadow-lg shadow-indigo-600/30"
                >
                  {currentQuizIdx < quizQuestions.length - 1 ? "Next Question →" : "Finish Quiz 🎉"}
                </button>
              )}
            </div>
          )}

          {/* Finished Celebration */}
          {quizFinished && (
            <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-3xl p-8 text-center space-y-6 shadow-xl">
              <div className="w-20 h-20 mx-auto rounded-3xl bg-amber-500/15 flex items-center justify-center text-4xl shadow-inner">
                🏆
              </div>
              <div>
                <h2 className="text-2xl font-black text-[var(--text-primary)]">Quiz Completed!</h2>
                <p className="text-[var(--text-secondary)] mt-1 font-medium">
                  You scored <strong className="text-[#6C63FF] font-black">{quizScore}</strong> out of {quizQuestions.length} correct!
                </p>
              </div>

              <div className="inline-block bg-emerald-500 text-white font-black px-6 py-2.5 rounded-2xl text-base shadow-md shadow-emerald-500/20">
                +{earnedXP} XP Earned ✨
              </div>

              {/* Mistakes Review */}
              {mistakesList.length > 0 ? (
                <div>
                  <button
                    onClick={() => setShowMistakes(!showMistakes)}
                    className="text-xs font-bold text-[#6C63FF] hover:underline"
                  >
                    {showMistakes ? "Hide Mistakes ▲" : `Review ${mistakesList.length} Mistakes ▼`}
                  </button>
                  {showMistakes && (
                    <div className="space-y-2 mt-3 text-left">
                      {mistakesList.map((m, i) => (
                        <div key={i} className="bg-rose-500/10 p-3 rounded-2xl text-xs space-y-1 border border-rose-500/20">
                          <p className="font-bold text-[var(--text-primary)]">{m.targetWord}</p>
                          <p className="text-rose-500 font-semibold">Your Answer: {m.userAnswer}</p>
                          <p className="text-emerald-500 font-bold">Correct: {m.correctAnswer}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-emerald-500 font-extrabold text-sm">🌟 100% Perfect Accuracy! 🌟</p>
              )}

              <div className="space-y-3 pt-4">
                <button
                  onClick={startQuiz}
                  className="w-full py-3.5 bg-[#6C63FF] hover:bg-indigo-700 text-white font-bold rounded-2xl transition-all shadow-md shadow-indigo-600/30"
                >
                  Retake Quiz with New Questions 🔄
                </button>
                <button
                  onClick={() => setActiveTab("list")}
                  className="w-full py-3 text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-bold text-sm"
                >
                  Back to Word Bank
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default Vocabulary;
