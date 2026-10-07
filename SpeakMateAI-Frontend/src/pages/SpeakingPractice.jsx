import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import ROUTES from "../constants/routes";
import { speakingService } from "../services/appServices";
import { authService } from "../services/authService";
import { useAuth } from "../context/AuthContext";
import { useModal } from "../context/ModalContext";
import { useToast } from "../context/ToastContext";
import { warmupSpeechAutoplay } from "../utils/speechHelper";
import { getLiveProgressStats } from "../utils/progressTracker";

// ─── Age-Wise Scenarios Data (10 scenarios per age group) ───────────────────
const AGE_SCENARIOS = {
  Kids: [
    { id: "k1", title: "Show & Tell", category: "General", difficulty: "Beginner", duration: 4, xp: 15, icon: "🎨", desc: "Share your favorite toy, book, or pet with your AI friend." },
    { id: "k2", title: "At the Zoo", category: "Daily Life", difficulty: "Beginner", duration: 5, xp: 15, icon: "🐾", desc: "Talk to the zoo guide about your favorite animals." },
    { id: "k3", title: "Ordering Ice Cream", category: "Daily Life", difficulty: "Beginner", duration: 4, xp: 15, icon: "🍦", desc: "Choose your favorite flavors and toppings at the ice cream shop." },
    { id: "k4", title: "My Favorite Superhero", category: "General", difficulty: "Beginner", duration: 5, xp: 15, icon: "⚡", desc: "Describe a superhero and their special powers!" },
    { id: "k5", title: "School Lunch Time", category: "Daily Life", difficulty: "Beginner", duration: 4, xp: 15, icon: "🍱", desc: "Chat with classmates about your lunch and playground games." },
    { id: "k6", title: "Space Adventure", category: "Travel", difficulty: "Intermediate", duration: 6, xp: 20, icon: "🚀", desc: "Explore new planets and talk to an alien space buddy." },
    { id: "k7", title: "Playing at the Park", category: "Daily Life", difficulty: "Beginner", duration: 4, xp: 15, icon: "⚽", desc: "Invite a friend to play on the swings and slides." },
    { id: "k8", title: "Birthday Party Fun", category: "General", difficulty: "Beginner", duration: 5, xp: 20, icon: "🎁", desc: "Wish a happy birthday, open gifts, and talk about party games." },
    { id: "k9", title: "Visiting the Doctor", category: "General", difficulty: "Intermediate", duration: 5, xp: 20, icon: "🩺", desc: "Explain how you feel to a friendly nurse or doctor." },
    { id: "k10", title: "Bedtime Story Time", category: "General", difficulty: "Intermediate", duration: 6, xp: 25, icon: "🌙", desc: "Co-create a fun bedtime fairytale with your AI coach." },
  ],
  Teens: [
    { id: "t1", title: "First Day at High School", category: "General", difficulty: "Beginner", duration: 5, xp: 15, icon: "🏫", desc: "Introduce yourself and make new friends at school." },
    { id: "t2", title: "Ordering Fast Food", category: "Daily Life", difficulty: "Beginner", duration: 4, xp: 15, icon: "🍔", desc: "Order burgers, fries, and drinks with your friends." },
    { id: "t3", title: "Gaming & Hobbies", category: "General", difficulty: "Beginner", duration: 5, xp: 15, icon: "🎮", desc: "Discuss your favorite video games, sports, and music bands." },
    { id: "t4", title: "Planning a Weekend Outing", category: "Daily Life", difficulty: "Intermediate", duration: 6, xp: 20, icon: "🎟️", desc: "Group chat to pick a movie or visit an amusement park." },
    { id: "t5", title: "Asking for Homework Help", category: "General", difficulty: "Intermediate", duration: 5, xp: 20, icon: "📚", desc: "Chat with a classmate or tutor about a tricky science assignment." },
    { id: "t6", title: "Shopping for Clothes", category: "Daily Life", difficulty: "Beginner", duration: 4, xp: 15, icon: "👕", desc: "Try on cool styles, check shoe sizes, and ask for discounts." },
    { id: "t7", title: "Preparing for School Exams", category: "Career", difficulty: "Intermediate", duration: 6, xp: 20, icon: "📓", desc: "Study session prep and sharing study tips with friends." },
    { id: "t8", title: "Joining a High School Club", category: "General", difficulty: "Intermediate", duration: 6, xp: 25, icon: "👥", desc: "Interview for the robotics, drama, or sports club." },
    { id: "t9", title: "Talking About Future Dreams", category: "Career", difficulty: "Advanced", duration: 7, xp: 30, icon: "🏆", desc: "Discuss dream colleges, tech careers, and personal goals." },
    { id: "t10", title: "Handling Peer Situations", category: "General", difficulty: "Advanced", duration: 7, xp: 30, icon: "💬", desc: "Resolve a misunderstanding with a friend politely." },
  ],
  "Young Adult": [
    { id: "y1", title: "Daily Conversation", category: "General", difficulty: "Beginner", duration: 5, xp: 15, icon: "💬", desc: "Chat about campus life, daily habits, and weekend plans." },
    { id: "y2", title: "Campus Coffee Shop", category: "Daily Life", difficulty: "Beginner", duration: 4, xp: 15, icon: "☕", desc: "Order artisan coffee, study snacks, and chat with baristas." },
    { id: "y3", title: "College Admission Interview", category: "Career", difficulty: "Intermediate", duration: 8, xp: 30, icon: "🎓", desc: "Answer admission questions and explain your choice of major." },
    { id: "y4", title: "Hostel & Roommate Chat", category: "Daily Life", difficulty: "Intermediate", duration: 5, xp: 20, icon: "🏠", desc: "Discuss sharing house chores, schedules, and groceries." },
    { id: "y5", title: "Backpacking & Travel", category: "Travel", difficulty: "Intermediate", duration: 6, xp: 25, icon: "✈️", desc: "Ask for local directions, book hostel beds, and meet travelers." },
    { id: "y6", title: "Part-time Job Interview", category: "Career", difficulty: "Intermediate", duration: 7, xp: 25, icon: "💼", desc: "Practice answering basic interview and customer service questions." },
    { id: "y7", title: "Attending a Tech Fest", category: "Career", difficulty: "Intermediate", duration: 6, xp: 25, icon: "⚙️", desc: "Network with peers and pitch ideas at a campus hackathon." },
    { id: "y8", title: "Renting Your First Apartment", category: "Daily Life", difficulty: "Advanced", duration: 7, xp: 30, icon: "🔑", desc: "Talk to a landlord about monthly rent, leases, and utilities." },
    { id: "y9", title: "Group Project Discussion", category: "General", difficulty: "Advanced", duration: 8, xp: 35, icon: "🖥️", desc: "Divide presentation roles and set project deadlines." },
    { id: "y10", title: "Public Speaking & Debate", category: "Work", difficulty: "Advanced", duration: 8, xp: 35, icon: "🎤", desc: "Pitch an argument clearly in a campus debate or presentation." },
  ],
  Professional: [
    { id: "p1", title: "Daily Conversation", category: "General", difficulty: "Beginner", duration: 5, xp: 15, icon: "💬", desc: "Chat about your day, hobbies, and general interests." },
    { id: "p2", title: "Ordering in Restaurant", category: "Daily Life", difficulty: "Beginner", duration: 4, xp: 15, icon: "🍽️", desc: "Order food, ask about the menu, and pay the bill." },
    { id: "p3", title: "Hotel Check-in", category: "Travel", difficulty: "Beginner", duration: 5, xp: 20, icon: "🏨", desc: "Check in, request room services, and ask for local recommendations." },
    { id: "p4", title: "Airport Customs", category: "Travel", difficulty: "Intermediate", duration: 6, xp: 25, icon: "✈️", desc: "Declare items, answer security questions, and handle arrivals." },
    { id: "p5_shop", title: "Shopping Helpers", category: "Daily Life", difficulty: "Beginner", duration: 4, xp: 15, icon: "🛒", desc: "Ask for sizes, negotiate prices, and make payments." },
    { id: "p5", title: "Office Small Talk", category: "Work", difficulty: "Intermediate", duration: 5, xp: 20, icon: "💼", desc: "Engage with colleagues, discuss weekends, and plan lunches." },
    { id: "p6", title: "Business Meeting", category: "Work", difficulty: "Advanced", duration: 8, xp: 30, icon: "👥", desc: "Present updates, pitch ideas, and negotiate corporate terms." },
    { id: "p7", title: "Job Interview Practice", category: "Career", difficulty: "Advanced", duration: 10, xp: 40, icon: "📄", desc: "Practice typical HR questions and explain your career goals." },
    { id: "p8", title: "Salary & Contract Negotiation", category: "Career", difficulty: "Advanced", duration: 8, xp: 35, icon: "💵", desc: "Negotiate compensation, benefits, and start date." },
    { id: "p9", title: "Presentation Skills", category: "Work", difficulty: "Advanced", duration: 7, xp: 30, icon: "🖼️", desc: "Practice starting, structuring, and concluding a keynote presentation." },
    { id: "p10", title: "Executive Coaching Session", category: "Work", difficulty: "Advanced", duration: 9, xp: 45, icon: "🎯", desc: "Refine high-level executive communication, leadership tone, and feedback." },
  ],
  Senior: [
    { id: "s1", title: "Relaxed Daily Conversation", category: "General", difficulty: "Beginner", duration: 5, xp: 15, icon: "💬", desc: "Chat comfortably about morning routines, weather, and life." },
    { id: "s2", title: "Tea Time & Gardening", category: "General", difficulty: "Beginner", duration: 5, xp: 15, icon: "🌿", desc: "Discuss plants, cooking recipes, and home hobbies." },
    { id: "s3", title: "Visiting the Pharmacy", category: "Daily Life", difficulty: "Beginner", duration: 4, xp: 15, icon: "🩺", desc: "Ask a pharmacist about prescription directions and advice." },
    { id: "s4", title: "Neighborhood Cafe", category: "Daily Life", difficulty: "Beginner", duration: 4, xp: 15, icon: "☕", desc: "Order breakfast and chat pleasantly with local staff." },
    { id: "s5", title: "Sharing Life Stories", category: "General", difficulty: "Intermediate", duration: 7, xp: 25, icon: "📖", desc: "Tell stories about childhood, family, and past trips." },
    { id: "s6", title: "Guided Museum Tour", category: "Travel", difficulty: "Intermediate", duration: 6, xp: 25, icon: "🏛️", desc: "Ask a tour guide questions about art, history, and culture." },
    { id: "s7", title: "Book & Movie Discussion", category: "General", difficulty: "Intermediate", duration: 6, xp: 25, icon: "🎬", desc: "Share thoughts on a favorite novel, movie, or biography." },
    { id: "s8", title: "Booking Holiday Travel", category: "Travel", difficulty: "Intermediate", duration: 6, xp: 25, icon: "🚆", desc: "Reserve train or plane tickets and ask about senior assistance." },
    { id: "s9", title: "Calling Customer Support", category: "Daily Life", difficulty: "Intermediate", duration: 5, xp: 20, icon: "📞", desc: "Get assistance with home internet, TV, or phone service." },
    { id: "s10", title: "Family & Grandchildren Chat", category: "General", difficulty: "Advanced", duration: 6, xp: 25, icon: "❤️", desc: "Practice modern terms and catch up with family news." },
  ],
};

// ─── School Grade Scenarios Data (10 per standard) ─────────────────────────
const STANDARD_SCENARIOS = {
  "1st Std": [
    { id: "std1_1", title: "Alphabet Phonics & A-B-C Sounds", category: "General", difficulty: "1st Std", duration: 4, xp: 15, icon: "🎨", desc: "Learn phonics and speak simple words like Apple, Ball, and Cat." },
    { id: "std1_2", title: "Colors & Drawing", category: "General", difficulty: "1st Std", duration: 4, xp: 15, icon: "🖌️", desc: "Describe your favorite colors and what you love to draw." },
    { id: "std1_3", title: "Animal Friends at Zoo & Farm", category: "Daily Life", difficulty: "1st Std", duration: 5, xp: 15, icon: "🐾", desc: "Talk about lions, monkeys, dogs, and cows with your AI teacher." },
    { id: "std1_4", title: "Friendly School Greetings", category: "Daily Life", difficulty: "1st Std", duration: 4, xp: 15, icon: "👋", desc: "Say Good Morning, Hello Teacher, and Thank You at school." },
    { id: "std1_5", title: "My Body Parts & Clean Habits", category: "General", difficulty: "1st Std", duration: 4, xp: 15, icon: "😊", desc: "Learn and speak names of eyes, ears, hands, and feet." },
    { id: "std1_6", title: "My Family Members & Home", category: "Daily Life", difficulty: "1st Std", duration: 4, xp: 15, icon: "❤️", desc: "Introduce your Father, Mother, Brother, and Sister in simple sentences." },
    { id: "std1_7", title: "Counting Numbers & My Toys", category: "General", difficulty: "1st Std", duration: 4, xp: 15, icon: "🔢", desc: "Practice counting toys and numbers 1 to 20 out loud." },
    { id: "std1_8", title: "My Favorite Fruits & Vegetables", category: "Daily Life", difficulty: "1st Std", duration: 4, xp: 15, icon: "🍎", desc: "Talk about sweet apples, bananas, and healthy carrots." },
    { id: "std1_9", title: "Vehicles & Road Sounds", category: "General", difficulty: "1st Std", duration: 4, xp: 15, icon: "🚗", desc: "Name cars, buses, trains, and bicycles with fun sounds." },
    { id: "std1_10", title: "Good Night & Bedtime Routine", category: "Daily Life", difficulty: "1st Std", duration: 4, xp: 15, icon: "🌙", desc: "Describe brushing teeth, saying good night, and sweet dreams." },
  ],
  "2nd Std": [
    { id: "std2_1", title: "Classroom Objects & Tools", category: "General", difficulty: "2nd Std", duration: 4, xp: 15, icon: "🏫", desc: "Name pencils, erasers, notebooks, rulers, and school bags." },
    { id: "std2_2", title: "My Daily Morning Routine", category: "Daily Life", difficulty: "2nd Std", duration: 5, xp: 15, icon: "☀️", desc: "Describe waking up, brushing teeth, and eating breakfast." },
    { id: "std2_3", title: "Weather & Clothes Today", category: "Daily Life", difficulty: "2nd Std", duration: 4, xp: 15, icon: "🌧️", desc: "Talk about sunny, rainy, and cold days and what you wear." },
    { id: "std2_4", title: "Ordering Ice Cream & Snacks", category: "Daily Life", difficulty: "2nd Std", duration: 4, xp: 15, icon: "🍦", desc: "Practice ordering chocolate, vanilla, and fruit scoops politely." },
    { id: "std2_5", title: "Toys & Playground Games", category: "General", difficulty: "2nd Std", duration: 5, xp: 15, icon: "⚽", desc: "Invite friends to play on swings, slides, and football ground." },
    { id: "std2_6", title: "Expressing My Feelings & Moods", category: "Daily Life", difficulty: "2nd Std", duration: 4, xp: 15, icon: "💬", desc: "Practice saying 'I am happy', 'I am tired', and 'I like reading'." },
    { id: "std2_7", title: "Shapes & Building Blocks", category: "General", difficulty: "2nd Std", duration: 4, xp: 15, icon: "🔺", desc: "Talk about circles, squares, triangles, and lego blocks." },
    { id: "std2_8", title: "My Pet & Animal Kindness", category: "General", difficulty: "2nd Std", duration: 5, xp: 15, icon: "🐶", desc: "Describe your pet and how to show love and kindness to animals." },
    { id: "std2_9", title: "Magic Words & Politeness", category: "Daily Life", difficulty: "2nd Std", duration: 4, xp: 15, icon: "✨", desc: "Master polite phrases like 'Please', 'Sorry', and 'Excuse me'." },
    { id: "std2_10", title: "Birthday Party Celebration", category: "Daily Life", difficulty: "2nd Std", duration: 5, xp: 15, icon: "🎂", desc: "Wish happy birthday, blow candles, and discuss fun party games." },
  ],
  "3rd Std": [
    { id: "std3_1", title: "Action Verbs & Activities", category: "General", difficulty: "3rd Std", duration: 5, xp: 20, icon: "⚡", desc: "Speak using action words like running, jumping, writing, and singing." },
    { id: "std3_2", title: "Friendly Doctor Visit", category: "Daily Life", difficulty: "3rd Std", duration: 5, xp: 20, icon: "🩺", desc: "Explain symptoms ('I have a fever', 'My arm hurts') to a doctor." },
    { id: "std3_3", title: "Community Helpers & Jobs", category: "General", difficulty: "3rd Std", duration: 5, xp: 20, icon: "👨‍🚒", desc: "Talk about doctors, firefighters, police officers, and teachers." },
    { id: "std3_4", title: "Telling Clock Time & Schedules", category: "Daily Life", difficulty: "3rd Std", duration: 4, xp: 15, icon: "⏰", desc: "Practice saying time ('It is 8 o'clock', 'Time for dinner')." },
    { id: "std3_5", title: "Stationery Shop Polite Buying", category: "Daily Life", difficulty: "3rd Std", duration: 4, xp: 15, icon: "✏️", desc: "Ask shopkeepers for pencils, paper, and crayons politely." },
    { id: "std3_6", title: "My Favorite Storybook & Hero", category: "General", difficulty: "3rd Std", duration: 5, xp: 20, icon: "📖", desc: "Tell your AI teacher about a superhero or fairytale story you read." },
    { id: "std3_7", title: "Healthy Food & Canteen Snacks", category: "Daily Life", difficulty: "3rd Std", duration: 4, xp: 15, icon: "🍎", desc: "Discuss fruits, vegetables, and canteen lunch items." },
    { id: "std3_8", title: "Seasons & Indian Festivals", category: "General", difficulty: "3rd Std", duration: 5, xp: 20, icon: "🎉", desc: "Talk about summer holidays, Diwali, Christmas, and rain." },
    { id: "std3_9", title: "Visiting the Zoo Guide", category: "Travel", difficulty: "3rd Std", duration: 5, xp: 20, icon: "🦁", desc: "Ask questions to a zookeeper about wild animals." },
    { id: "std3_10", title: "Classroom Helper & Desk Care", category: "Daily Life", difficulty: "3rd Std", duration: 5, xp: 20, icon: "🧹", desc: "Help the teacher distribute books and keep desks tidy." },
  ],
  "4th Std": [
    { id: "std4_1", title: "School Canteen Order", category: "Daily Life", difficulty: "4th Std", duration: 5, xp: 20, icon: "🥪", desc: "Order lunch, ask for water, and calculate coins politely." },
    { id: "std4_2", title: "Asking Directions at School", category: "Daily Life", difficulty: "4th Std", duration: 5, xp: 20, icon: "🗺️", desc: "Ask where the library, computer lab, or sports ground is." },
    { id: "std4_3", title: "Solar System & Space Rocket Journey", category: "General", difficulty: "4th Std", duration: 6, xp: 25, icon: "🚀", desc: "Explore Earth, Moon, Mars, and rockets with your space buddy." },
    { id: "std4_4", title: "Describing My Hometown & Landmarks", category: "General", difficulty: "4th Std", duration: 5, xp: 20, icon: "🏙️", desc: "Describe your city, famous parks, and landmarks." },
    { id: "std4_5", title: "Visiting Grandpa's Farm & Crops", category: "Travel", difficulty: "4th Std", duration: 5, xp: 20, icon: "🚜", desc: "Describe tractors, cows, fresh milk, and farm animals." },
    { id: "std4_6", title: "Healthy Habits & Outdoor Sports", category: "Daily Life", difficulty: "4th Std", duration: 5, xp: 20, icon: "🏸", desc: "Discuss eating vegetables, drinking water, and outdoor sports." },
    { id: "std4_7", title: "Comparing Animal Sizes & Speeds", category: "General", difficulty: "4th Std", duration: 5, xp: 20, icon: "📊", desc: "Practice comparative words (bigger, faster, taller) with animals." },
    { id: "std4_8", title: "Past Weekend Family Outing", category: "Daily Life", difficulty: "4th Std", duration: 6, xp: 25, icon: "⛺", desc: "Use simple past tense to describe a family outing." },
    { id: "std4_9", title: "My Hobbies & Creative Talents", category: "General", difficulty: "4th Std", duration: 5, xp: 20, icon: "🎨", desc: "Talk about drawing, singing, playing cricket, or reading." },
    { id: "std4_10", title: "School Library Book Borrowing", category: "General", difficulty: "4th Std", duration: 5, xp: 20, icon: "📚", desc: "Ask the librarian to borrow adventure or science books." },
  ],
  "5th Std": [
    { id: "std5_1", title: "First Day in 5th Grade", category: "General", difficulty: "5th Std", duration: 5, xp: 20, icon: "🎒", desc: "Introduce yourself to new classmates and talk about favorite subjects." },
    { id: "std5_2", title: "Planning a Class Picnic", category: "Daily Life", difficulty: "5th Std", duration: 6, xp: 25, icon: "🧺", desc: "Discuss picnic spots, sports games, and group snacks with friends." },
    { id: "std5_3", title: "Science Project Idea Pitch", category: "General", difficulty: "5th Std", duration: 6, xp: 25, icon: "🔬", desc: "Explain your science project model (volcano, solar system, plants)." },
    { id: "std5_4", title: "Storybook Character Review", category: "General", difficulty: "5th Std", duration: 6, xp: 25, icon: "📚", desc: "Describe the main hero, plot, and moral of a story you read." },
    { id: "std5_5", title: "Environmental Care & Trees", category: "Daily Life", difficulty: "5th Std", duration: 5, xp: 20, icon: "🌍", desc: "Talk about planting trees, recycling paper, and keeping school clean." },
    { id: "std5_6", title: "Planning a Weekend Trip", category: "Travel", difficulty: "5th Std", duration: 6, xp: 25, icon: "🗺️", desc: "Plan a trip to a museum or beach using future tense (will, going to)." },
    { id: "std5_7", title: "School Bus Friendship & Ride", category: "Daily Life", difficulty: "5th Std", duration: 5, xp: 20, icon: "🚌", desc: "Chat with bus mates and discuss road and bus safety rules." },
    { id: "std5_8", title: "Annual Sports Meet Cheering", category: "General", difficulty: "5th Std", duration: 6, xp: 25, icon: "🏆", desc: "Cheer for your school house team and celebrate sportsmanship." },
    { id: "std5_9", title: "Supermarket Polite Shopping", category: "Daily Life", difficulty: "5th Std", duration: 5, xp: 20, icon: "🛒", desc: "Check grocery lists, ask prices, and handle counter billing." },
    { id: "std5_10", title: "My Dream Career & Ambition", category: "Career", difficulty: "5th Std", duration: 6, xp: 25, icon: "🌟", desc: "Explain why you want to become a scientist, pilot, doctor, or artist." },
  ],
  "6th Std": [
    { id: "std6_1", title: "Asking Teacher Homework Help", category: "Daily Life", difficulty: "6th Std", duration: 5, xp: 20, icon: "🙋‍♂️", desc: "Politely ask your teacher to clarify math equations or history notes." },
    { id: "std6_2", title: "Robotics & Science Club Interview", category: "General", difficulty: "6th Std", duration: 6, xp: 25, icon: "🤖", desc: "Present your project idea and interview for the school robotics club." },
    { id: "std6_3", title: "Annual Sports Day Commentary", category: "General", difficulty: "6th Std", duration: 6, xp: 25, icon: "🏆", desc: "Practice live commentary for relay races and football finals." },
    { id: "std6_4", title: "Shopping for Clothes & Shoe Sizing", category: "Daily Life", difficulty: "6th Std", duration: 5, xp: 20, icon: "👕", desc: "Try on shoes, check sizes, and ask sales staff for assistance." },
    { id: "std6_5", title: "School Debate: Daily Homework", category: "General", difficulty: "6th Std", duration: 6, xp: 25, icon: "💬", desc: "Formulate persuasive arguments for and against weekend homework." },
    { id: "std6_6", title: "Library Book & Mystery Recommendation", category: "General", difficulty: "6th Std", duration: 6, xp: 25, icon: "📕", desc: "Recommend a mystery or adventure book to a classmate." },
    { id: "std6_7", title: "Computer Lab, Coding & Internet Safety", category: "Work", difficulty: "6th Std", duration: 6, xp: 25, icon: "💻", desc: "Talk about typing skills, Scratch programming, and internet safety." },
    { id: "std6_8", title: "Preparing for Unit Tests & Revision", category: "Daily Life", difficulty: "6th Std", duration: 5, xp: 20, icon: "✍️", desc: "Discuss study timetables and revision strategies with classmates." },
    { id: "std6_9", title: "Daily Habits & Present Perfect Tense Practice", category: "General", difficulty: "6th Std", duration: 6, xp: 25, icon: "✅", desc: "Use present perfect structures ('I have completed', 'She has visited')." },
    { id: "std6_10", title: "School Exhibition Guide Presentation", category: "General", difficulty: "6th Std", duration: 6, xp: 25, icon: "🎪", desc: "Welcome guests and guide them through class science stalls." },
  ],
  "7th Std": [
    { id: "std7_1", title: "Group Discussion: Water Conservation & Climate", category: "General", difficulty: "7th Std", duration: 7, xp: 30, icon: "💧", desc: "Participate in a group discussion on saving water and global warming." },
    { id: "std7_2", title: "Science Fair Exhibition Project Presentation", category: "General", difficulty: "7th Std", duration: 7, xp: 30, icon: "⚡", desc: "Present your renewable energy or robotics model to judges." },
    { id: "std7_3", title: "Movie & Book Critical Review", category: "General", difficulty: "7th Std", duration: 6, xp: 25, icon: "🎬", desc: "Analyze characters, climax, cinematography, and moral lessons." },
    { id: "std7_4", title: "Debate: Smartphones in Classrooms", category: "General", difficulty: "7th Std", duration: 7, xp: 30, icon: "📱", desc: "Debate pros and cons of digital learning vs classroom distraction." },
    { id: "std7_5", title: "Organizing School Cultural Festival", category: "Daily Life", difficulty: "7th Std", duration: 8, xp: 30, icon: "🎭", desc: "Delegate tasks for stage decor, dance routines, and ticket sales." },
    { id: "std7_6", title: "School Heritage Field Trip & Monuments", category: "Travel", difficulty: "7th Std", duration: 6, xp: 25, icon: "🏛️", desc: "Ask tour guides detailed questions about historical monuments." },
    { id: "std7_7", title: "Asking Directions in an Unknown City", category: "Travel", difficulty: "7th Std", duration: 6, xp: 25, icon: "🧭", desc: "Ask locals for subway lines, bus stands, and historic landmarks." },
    { id: "std7_8", title: "Student Council Campaign Election Speech", category: "Career", difficulty: "7th Std", duration: 8, xp: 35, icon: "🎤", desc: "Deliver a campaign speech for Class Captain or Sports Prefect." },
    { id: "std7_9", title: "Polite Formal Requests & Phrasing", category: "Daily Life", difficulty: "7th Std", duration: 7, xp: 25, icon: "💬", desc: "Refined polite phrases ('Could you please...', 'I would appreciate...')." },
    { id: "std7_10", title: "Historical Figures & Public Speech", category: "General", difficulty: "7th Std", duration: 7, xp: 30, icon: "📜", desc: "Deliver a short presentation on a famous inventor or leader." },
  ],
  "8th Std": [
    { id: "std8_1", title: "Inter-School Debate: Social Media vs Books", category: "General", difficulty: "8th Std", duration: 8, xp: 35, icon: "💬", desc: "Present strong arguments and counter-rebuttals on social issues." },
    { id: "std8_2", title: "Artificial Intelligence & Future Tech Innovations", category: "Work", difficulty: "8th Std", duration: 7, xp: 30, icon: "🤖", desc: "Discuss artificial intelligence, space probes, and future tech." },
    { id: "std8_3", title: "Student Council Leadership & House Meeting", category: "Career", difficulty: "8th Std", duration: 8, xp: 35, icon: "🏛️", desc: "Lead house meetings, organize events, and address student queries." },
    { id: "std8_4", title: "Planning a Community Charity Campaign", category: "Daily Life", difficulty: "8th Std", duration: 8, xp: 30, icon: "❤️", desc: "Pitch ideas for helping local shelters and organizing donation drives." },
    { id: "std8_5", title: "High School Electives & Stream Selection", category: "Career", difficulty: "8th Std", duration: 6, xp: 25, icon: "🎯", desc: "Discuss choosing Science, Commerce, Arts, or Vocational streams." },
    { id: "std8_6", title: "Formal Email Writing & Out-Loud Speech", category: "Daily Life", difficulty: "8th Std", duration: 7, xp: 30, icon: "✉️", desc: "Practice speaking out loud a formal request email to your principal." },
    { id: "std8_7", title: "School Magazine Article Editorial Pitch", category: "General", difficulty: "8th Std", duration: 7, xp: 30, icon: "📰", desc: "Pitch an editorial article on mental health or youth hobbies." },
    { id: "std8_8", title: "Career Aspirations & 10-Year Goals", category: "Career", difficulty: "8th Std", duration: 8, xp: 35, icon: "💼", desc: "Discuss career paths in Engineering, Medicine, Arts, and Tech." },
    { id: "std8_9", title: "Mock Model United Nations (MUN) Resolution", category: "General", difficulty: "8th Std", duration: 9, xp: 40, icon: "🌐", desc: "Represent a country delegate and present formal resolution speeches." },
    { id: "std8_10", title: "Overcoming Stage Fear & Confident Body Language", category: "General", difficulty: "8th Std", duration: 7, xp: 30, icon: "🧍", desc: "Master confident eye contact, breath control, and vocal projection." },
  ],
  "9th Std": [
    { id: "std9_1", title: "Mock High School & Academic Admission Interview", category: "Career", difficulty: "9th Std", duration: 8, xp: 40, icon: "🎓", desc: "Practice formal interview questions for high school admissions." },
    { id: "std9_2", title: "Keynote Speech: Global Climate Action", category: "Career", difficulty: "9th Std", duration: 8, xp: 40, icon: "🌍", desc: "Deliver a structured keynote address on renewable energy." },
    { id: "std9_3", title: "Keynote Speech: Youth Leadership & Innovation", category: "Career", difficulty: "9th Std", duration: 8, xp: 40, icon: "🎤", desc: "Deliver an inspiring keynote speech to a school auditorium." },
    { id: "std9_4", title: "Debate: Digital vs Physical Schooling", category: "General", difficulty: "9th Std", duration: 8, xp: 35, icon: "🏫", desc: "Argue the pros and cons of online learning vs physical classrooms." },
    { id: "std9_5", title: "Academic Essay Thesis & Oral Defense", category: "General", difficulty: "9th Std", duration: 7, xp: 35, icon: "📄", desc: "Defend your research paper thesis and answer teacher questions." },
    { id: "std9_6", title: "Resolving Peer Conflict Diplomatic Skills", category: "Daily Life", difficulty: "9th Std", duration: 8, xp: 30, icon: "🤝", desc: "Handle interpersonal disagreements constructively using polite language." },
    { id: "std9_7", title: "STEM & Tech Career Roadmaps", category: "Career", difficulty: "9th Std", duration: 8, xp: 40, icon: "🚀", desc: "Discuss engineering, medical, coding, and finance career paths." },
    { id: "std9_8", title: "Current World Affairs & Scientific Discoveries", category: "General", difficulty: "9th Std", duration: 8, xp: 35, icon: "🛰️", desc: "Discuss recent scientific discoveries, space missions, and global news." },
    { id: "std9_9", title: "Formal Email & Request to School Principal", category: "Work", difficulty: "9th Std", duration: 6, xp: 30, icon: "✉️", desc: "Request event permissions and venue bookings in formal tone." },
    { id: "std9_10", title: "Advanced Rhetoric, Native Idioms & Transitions", category: "General", difficulty: "9th Std", duration: 8, xp: 40, icon: "🎗️", desc: "Incorporate sophisticated vocabulary and persuasive transitions." },
  ],
  "10th Std": [
    { id: "std10_1", title: "10th Board Oral Exam Simulation", category: "Career", difficulty: "10th Std", duration: 10, xp: 50, icon: "📋", desc: "Simulate official 10th Board oral examination with strict feedback." },
    { id: "std10_2", title: "College Major & Career Pathway Pitch", category: "Career", difficulty: "10th Std", duration: 8, xp: 40, icon: "🚀", desc: "Pitch your chosen career roadmap in Engineering, Medicine, Arts, or Tech." },
    { id: "std10_3", title: "Public Keynote & Q&A Defense Strategy", category: "Work", difficulty: "10th Std", duration: 9, xp: 45, icon: "🎤", desc: "Deliver a persuasive speech and answer challenging follow-up questions." },
    { id: "std10_4", title: "Global Youth Leadership Summit & Policy", category: "General", difficulty: "10th Std", duration: 10, xp: 50, icon: "🌐", desc: "Discuss international relations, innovation, and youth leadership." },
    { id: "std10_5", title: "Native Idioms & Advanced Phrasal Verbs", category: "General", difficulty: "10th Std", duration: 8, xp: 40, icon: "🎗️", desc: "Master incorporating native idioms and expressions into speeches." },
    { id: "std10_6", title: "CEFR C1 Level Spontaneous Oratory Mastery", category: "Work", difficulty: "10th Std", duration: 10, xp: 50, icon: "⭐", desc: "Master persuasive rhetoric, tone modulation, and spontaneous fluency." },
    { id: "std10_7", title: "Group Discussion: Ethics in Artificial Intelligence", category: "General", difficulty: "10th Std", duration: 9, xp: 45, icon: "🤖", desc: "Discuss AI bias, deepfakes, automation, and privacy ethics." },
    { id: "std10_8", title: "Internship & Apprenticeship Interview Simulation", category: "Career", difficulty: "10th Std", duration: 9, xp: 45, icon: "💼", desc: "Answer behavioral interview questions using the structured STAR method." },
    { id: "std10_9", title: "Critical Thinking: Analyzing News & Misinformation", category: "General", difficulty: "10th Std", duration: 8, xp: 40, icon: "📰", desc: "Detect biases, media spin, and present fact-based arguments." },
    { id: "std10_10", title: "Valedictory Farewell Speech to School", category: "Work", difficulty: "10th Std", duration: 10, xp: 50, icon: "🎓", desc: "Deliver an eloquent, emotional farewell speech to teachers and juniors." },
  ],
};

const CATEGORIES = ["All", "General", "Daily Life", "Travel", "Work", "Career"];

const normalizeAgeGroup = (rawAge) => {
  if (!rawAge) return "Professional";
  const s = String(rawAge).toLowerCase();
  if (s.includes("kid")) return "Kids";
  if (s.includes("teen")) return "Teens";
  if (s.includes("young")) return "Young Adult";
  if (s.includes("senior")) return "Senior";
  if (s.includes("prof")) return "Professional";
  return "Professional";
};

const SPEAKING_HISTORY_CACHE_KEY = "speakmate_speaking_history_cache";

const getCachedSpeakingHistory = (userEmail) => {
  if (!userEmail) return [];
  try {
    const key = `${SPEAKING_HISTORY_CACHE_KEY}_${String(userEmail).toLowerCase().trim()}`;
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const setCachedSpeakingHistory = (data, userEmail) => {
  if (!userEmail) return;
  try {
    const key = `${SPEAKING_HISTORY_CACHE_KEY}_${String(userEmail).toLowerCase().trim()}`;
    localStorage.setItem(key, JSON.stringify(data));
  } catch {}
};

export function SpeakingPractice() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showConfirm } = useModal();
  const toast = useToast();

  const accountType = localStorage.getItem("speakmate_account_type") || user?.accountType || "INDIVIDUAL_USER";
  const isStudent = accountType === "STUDENT" || Boolean(user?.schoolGrade) || Boolean(user?.isSchoolStudent);

  const [history, setHistory] = useState(() => getCachedSpeakingHistory(user?.email));
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(() => localStorage.getItem("speakmate_speaking_category") || "All");

  const [selectedGrade, setSelectedGrade] = useState(
    () => user?.schoolGrade || localStorage.getItem("speakmate_school_grade") || "1st Std"
  );
  const [selectedAgeGroup, setSelectedAgeGroup] = useState(
    () => normalizeAgeGroup(user?.ageGroup || localStorage.getItem("speakmate_age_group") || "Professional")
  );

  const loadData = async () => {
    try {
      const rawHistory = await speakingService.history().catch(() => []);
      const validHistory = Array.isArray(rawHistory)
        ? rawHistory.filter(item => item && (Number(item.overallScore || item.score || 0) > 0) && !String(item.previewMessage || '').includes('no speaking activity'))
        : [];
      setHistory(validHistory);
      setCachedSpeakingHistory(validHistory, user?.email);

      const effectiveAge = user?.ageGroup || localStorage.getItem("speakmate_age_group");
      if (effectiveAge) {
        const norm = normalizeAgeGroup(effectiveAge);
        setSelectedAgeGroup(norm);
      }
      const effectiveGrade = user?.schoolGrade || localStorage.getItem("speakmate_school_grade");
      if (effectiveGrade) {
        setSelectedGrade(effectiveGrade);
      }
    } catch (e) {
      console.warn("Failed to load speaking data", e);
    }
  };

  useEffect(() => {
    if (user?.ageGroup) {
      const norm = normalizeAgeGroup(user.ageGroup);
      setSelectedAgeGroup(norm);
      localStorage.setItem("speakmate_age_group", norm);
    }
    if (user?.schoolGrade) {
      setSelectedGrade(user.schoolGrade);
      localStorage.setItem("speakmate_school_grade", user.schoolGrade);
    }
  }, [user?.ageGroup, user?.schoolGrade]);

  useEffect(() => {
    loadData();
    const handleProgressUpdate = (e) => {
      const d = e?.detail;
      if (d?.schoolGrade) {
        setSelectedGrade(d.schoolGrade);
        localStorage.setItem("speakmate_school_grade", d.schoolGrade);
      }
      if (d?.ageGroup) {
        const norm = normalizeAgeGroup(d.ageGroup);
        setSelectedAgeGroup(norm);
        localStorage.setItem("speakmate_age_group", norm);
      }
      loadData();
    };
    const handleAgeChange = (e) => {
      const newAge = e?.detail?.ageGroup || user?.ageGroup || localStorage.getItem("speakmate_age_group");
      if (newAge) {
        const norm = normalizeAgeGroup(newAge);
        setSelectedAgeGroup(norm);
        localStorage.setItem("speakmate_age_group", norm);
      }
    };

    window.addEventListener("focus", handleProgressUpdate);
    window.addEventListener("speakmate_progress_updated", handleProgressUpdate);
    window.addEventListener("speakmate_age_group_changed", handleAgeChange);
    window.addEventListener("speakmate_settings_updated", handleProgressUpdate);
    return () => {
      window.removeEventListener("focus", handleProgressUpdate);
      window.removeEventListener("speakmate_progress_updated", handleProgressUpdate);
      window.removeEventListener("speakmate_age_group_changed", handleAgeChange);
      window.removeEventListener("speakmate_settings_updated", handleProgressUpdate);
    };
  }, []);

  const liveStats = getLiveProgressStats(user);
  // Strictly speaking-specific stats: minutes spent on speaking, XP earned from speaking sessions, and completed sessions
  const totalMinutes = Math.round(history.reduce((sum, item) => sum + (item.duration || 0), 0) / 60);
  const totalXP = history.reduce((sum, item) => sum + (item.xpEarned || 0), 0);
  const totalSessions = history.length;
  const streakDays = Number(liveStats.streak ?? 0);

  const effAge = normalizeAgeGroup(selectedAgeGroup);
  const currentScenarios = isStudent
    ? (STANDARD_SCENARIOS[selectedGrade] || STANDARD_SCENARIOS["1st Std"])
    : (AGE_SCENARIOS[effAge] || AGE_SCENARIOS.Professional);

  const filteredScenarios = currentScenarios.filter((scenario) => {
    const matchesCategory = selectedCategory === "All" || scenario.category === selectedCategory;
    const matchesSearch =
      scenario.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      scenario.desc.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleStartScenario = (scenario) => {
    warmupSpeechAutoplay();
    const cleanScn = (scenario.title || "").replace(/\b(conversation|practice|session)\b/gi, "").trim();
    const scnLabel = cleanScn ? `${cleanScn} ` : "";
    const defaultGreeting = scenario.desc
      ? `Hello! Welcome to our ${scnLabel}practice. ${scenario.desc} Let's get started!`
      : `Hello! Welcome to our ${scnLabel}conversation practice. How can I help you today?`;

    // Navigate immediately to preserve browser audio autoplay user-gesture token
    navigate(ROUTES.CONVERSATION_SESSION, {
      state: {
        scenarioId: scenario.id,
        scenarioTitle: scenario.title,
        scenarioIcon: scenario.icon,
        scenarioDesc: scenario.desc,
        initialGreeting: defaultGreeting,
        xpReward: scenario.xp || 20,
        level: isStudent ? selectedGrade : selectedAgeGroup,
      },
    });
  };

  const handleDeleteHistoryItem = async (id, e) => {
    e.stopPropagation();
    const confirmed = await showConfirm({
      title: "Delete Practice Record?",
      message: "Are you sure you want to delete this speaking practice history item?",
      confirmText: "Delete Record",
      cancelText: "Keep Record",
      type: "danger",
    });

    if (confirmed) {
      try {
        await speakingService.deleteHistory(id);
        setHistory((prev) => {
          const updated = prev.filter((h) => h.id !== id);
          setCachedSpeakingHistory(updated);
          return updated;
        });
        toast.success("Practice record deleted successfully!");
      } catch (err) {
        console.error("Failed to delete history item:", err);
        toast.error("Could not delete speaking session record.");
      }
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-8 px-2 sm:px-4 lg:px-6 py-2">
      {/* Hero Banner with 4-Stat Bar */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0F172A] via-[#1E1B4B] to-[#312E81] p-6 sm:p-10 text-white shadow-2xl space-y-6 border border-white/10">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-72 h-72 rounded-full bg-indigo-500/15 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/15 backdrop-blur-md text-xs font-black uppercase tracking-wider text-amber-300 border border-white/20 shadow-sm mb-3.5 sm:mb-4">
              {isStudent ? `🎓 School Grade: ${selectedGrade}` : `👤 Target Profile: ${selectedAgeGroup}`}
            </div>
            <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight mb-2.5">Speaking Practice Studio</h1>
            <p className="text-sm sm:text-base text-indigo-200 font-medium leading-relaxed">
              Interactive AI conversation scenarios tailored to your{" "}
              <strong className="text-white">{isStudent ? selectedGrade : selectedAgeGroup}</strong> curriculum and fluency goals.
            </p>
          </div>
        </div>

        {/* 4-Stat Dashboard Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 pt-2">
          <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 flex flex-col items-center justify-center text-center">
            <span className="text-2xl sm:text-3xl font-black text-amber-400">{streakDays} 🔥</span>
            <span className="text-[10px] sm:text-xs font-black text-indigo-200 uppercase tracking-wider mt-1">Streak Days</span>
          </div>

          <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 flex flex-col items-center justify-center text-center">
            <span className="text-2xl sm:text-3xl font-black text-sky-300">{totalMinutes}m</span>
            <span className="text-[10px] sm:text-xs font-black text-indigo-200 uppercase tracking-wider mt-1">Total Mins</span>
          </div>

          <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 flex flex-col items-center justify-center text-center">
            <span className="text-2xl sm:text-3xl font-black text-amber-300">{totalXP} ⭐</span>
            <span className="text-[10px] sm:text-xs font-black text-indigo-200 uppercase tracking-wider mt-1">XP Earned</span>
          </div>

          <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 flex flex-col items-center justify-center text-center">
            <span className="text-2xl sm:text-3xl font-black text-white">{totalSessions}</span>
            <span className="text-[10px] sm:text-xs font-black text-indigo-200 uppercase tracking-wider mt-1">Sessions Done</span>
          </div>
        </div>
      </div>

      {/* Student Badge Indicator */}
      {isStudent && (
        <div className="px-4 py-2.5 rounded-2xl bg-[#6C63FF]/15 border border-[#6C63FF]/30 text-[#6C63FF] font-extrabold text-xs sm:text-sm inline-flex items-center gap-2 shadow-sm">
          <span>🎓 School Grade Curriculum Level: <strong>{selectedGrade}</strong></span>
        </div>
      )}

      {/* Category Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-2.5 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-default)]">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => {
                setSelectedCategory(cat);
                localStorage.setItem("speakmate_speaking_category", cat);
              }}
              className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black shrink-0 transition-all active:scale-95 ${
                selectedCategory === cat
                  ? "bg-gradient-to-r from-[#6C63FF] to-[#8B5CF6] text-white shadow-md shadow-[#6C63FF]/25 scale-102"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)]"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Search Bar Input */}
        <input
          type="text"
          placeholder="🔍 Search conversation scenarios..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="px-4 py-2.5 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] text-xs sm:text-sm font-bold text-[var(--text-primary)] focus:outline-none focus:border-[#6C63FF] w-full sm:w-72 shadow-inner"
        />
      </div>

      {/* Conversation Scenarios Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-black text-[var(--text-primary)] flex items-center gap-2.5">
            <span>{isStudent ? `🏫 ${selectedGrade} Practice Scenarios` : `🗣️ ${selectedAgeGroup} Conversation Scenarios`}</span>
          </h3>
          <span className="text-xs font-extrabold text-[var(--text-secondary)]">
            {filteredScenarios.length} Scenarios Available
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredScenarios.map((scenario) => (
            <div
              key={scenario.id}
              onClick={() => handleStartScenario(scenario)}
              className="group glass-card glass-card-hover p-6 rounded-3xl space-y-4 flex flex-col justify-between cursor-pointer border border-[var(--border-default)] hover:border-[#6C63FF]/60 hover:shadow-xl transition-all duration-300"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-3xl p-3.5 rounded-2xl bg-[var(--bg-elevated)] shadow-inner">
                    {scenario.icon}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-full bg-[#6C63FF]/15 text-[#6C63FF]">
                      {scenario.category}
                    </span>
                    <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-500">
                      ⭐ +{scenario.xp} XP
                    </span>
                  </div>
                </div>

                <div>
                  <h4 className="font-black text-base sm:text-lg text-[var(--text-primary)] group-hover:text-[#6C63FF] transition-colors">
                    {scenario.title}
                  </h4>
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed mt-1.5 line-clamp-2 font-medium">
                    {scenario.desc}
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t border-[var(--border-default)] flex items-center justify-between">
                <span className="text-xs text-[var(--text-secondary)] font-extrabold">
                  ⏱️ {scenario.duration} mins • {isStudent ? selectedGrade : scenario.difficulty}
                </span>
                <button className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#6C63FF] to-[#8B5CF6] group-hover:opacity-95 text-white font-black text-xs shadow-md transition-all">
                  Start Practice →
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Speaking History Section ── */}
      <div className="space-y-4 pt-4 border-t border-[var(--border-default)]">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-black text-[var(--text-primary)] flex items-center gap-2.5">
            <span>📜 Speaking Practice History</span>
          </h3>
          <span className="text-xs font-bold text-[var(--text-secondary)]">
            {history.length} Practice Records Saved
          </span>
        </div>

        {history.length === 0 ? (
          <div className="p-8 rounded-3xl bg-[var(--bg-elevated)] border border-[var(--border-default)] text-center space-y-3">
            <span className="text-4xl block">🎙️</span>
            <h4 className="font-black text-base text-[var(--text-primary)]">No speaking history yet</h4>
            <p className="text-xs text-[var(--text-secondary)] max-w-sm mx-auto font-medium">
              Start any conversation scenario above to practice your spoken English and build your transcript history!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {history.map((item) => (
              <div
                key={item.id}
                onClick={() => navigate(`/speaking/history/${item.id}`, { state: { session: item } })}
                className="group p-5 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-default)] hover:border-[#6C63FF]/50 transition-all flex items-start justify-between gap-4 cursor-pointer shadow-sm hover:shadow-md"
              >
                <div className="flex items-start gap-3.5 min-w-0">
                  <div className="p-3 rounded-xl bg-[#6C63FF]/15 text-[#6C63FF] text-xl shrink-0">
                    💬
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-black text-sm text-[var(--text-primary)] truncate group-hover:text-[#6C63FF] transition-colors">
                      {item.scenario || "Speaking Practice Session"}
                    </h4>
                    <p className="text-[11px] text-[var(--text-secondary)] font-bold mt-0.5">
                      {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : "Recent"} • {Math.round((item.duration || 0) / 60)} min •{" "}
                      <span className={`font-extrabold ${(item.score ?? 0) > 0 ? "text-emerald-500" : "text-amber-500"}`}>
                        {item.score !== null && item.score !== undefined ? Math.round(item.score) : 0}% Score
                      </span>
                    </p>
                    <p className="text-xs text-[var(--text-secondary)] font-medium line-clamp-1 mt-1">
                      {item.previewMessage || item.feedback || "Completed speaking practice simulation."}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(e) => handleDeleteHistoryItem(item.id, e)}
                  title="Delete record"
                  className="p-2 rounded-xl text-rose-500 hover:bg-rose-500/10 transition-colors shrink-0 font-extrabold text-sm"
                >
                  🗑️
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default SpeakingPractice;
