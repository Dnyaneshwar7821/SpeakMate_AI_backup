/**
 * SpeakingHomeScreen
 * Speaking Practice dashboard with statistics, Streak, Scenarios categorized,
 * and History. Includes custom prompt simulation and scenario search.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../context/ThemeContext';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { speakingService, onboardingService } from '../../services/appServices';
import { COLORS } from '../../constants/colors';
import LevelSegmentedControl from '../../components/common/LevelSegmentedControl';
import { getCachedAvatarModel, resolveAvatarFromVoice } from '../../config/AvatarCatalog';
import { DashboardCache } from '../../utils/dashboardCache';

// ─── Age-Wise Scenarios Data (10 scenarios per age group) ───────────────────

const AGE_SCENARIOS = {
  Kids: [
    { id: 'k1', title: 'Show & Tell', category: 'General', difficulty: 'Beginner', duration: 4, xp: 15, icon: 'color-palette-outline', desc: 'Share your favorite toy, book, or pet with your AI friend.' },
    { id: 'k2', title: 'At the Zoo', category: 'Daily Life', difficulty: 'Beginner', duration: 5, xp: 15, icon: 'paw-outline', desc: 'Talk to the zoo guide about your favorite animals.' },
    { id: 'k3', title: 'Ordering Ice Cream', category: 'Daily Life', difficulty: 'Beginner', duration: 4, xp: 15, icon: 'ice-cream-outline', desc: 'Choose your favorite flavors and toppings at the ice cream shop.' },
    { id: 'k4', title: 'My Favorite Superhero', category: 'General', difficulty: 'Beginner', duration: 5, xp: 15, icon: 'flash-outline', desc: 'Describe a superhero and their special powers!' },
    { id: 'k5', title: 'School Lunch Time', category: 'Daily Life', difficulty: 'Beginner', duration: 4, xp: 15, icon: 'restaurant-outline', desc: 'Chat with classmates about your lunch and playground games.' },
    { id: 'k6', title: 'Space Adventure', category: 'Travel', difficulty: 'Intermediate', duration: 6, xp: 20, icon: 'planet-outline', desc: 'Explore new planets and talk to an alien space buddy.' },
    { id: 'k7', title: 'Playing at the Park', category: 'Daily Life', difficulty: 'Beginner', duration: 4, xp: 15, icon: 'football-outline', desc: 'Invite a friend to play on the swings and slides.' },
    { id: 'k8', title: 'Birthday Party Fun', category: 'General', difficulty: 'Beginner', duration: 5, xp: 20, icon: 'gift-outline', desc: 'Wish a happy birthday, open gifts, and talk about party games.' },
    { id: 'k9', title: 'Visiting the Doctor', category: 'General', difficulty: 'Intermediate', duration: 5, xp: 20, icon: 'medkit-outline', desc: 'Explain how you feel to a friendly nurse or doctor.' },
    { id: 'k10', title: 'Bedtime Story Time', category: 'General', difficulty: 'Intermediate', duration: 6, xp: 25, icon: 'moon-outline', desc: 'Co-create a fun bedtime fairytale with your AI coach.' },
  ],
  Teens: [
    { id: 't1', title: 'First Day at High School', category: 'General', difficulty: 'Beginner', duration: 5, xp: 15, icon: 'school-outline', desc: 'Introduce yourself and make new friends at school.' },
    { id: 't2', title: 'Ordering Fast Food', category: 'Daily Life', difficulty: 'Beginner', duration: 4, xp: 15, icon: 'fast-food-outline', desc: 'Order burgers, fries, and drinks with your friends.' },
    { id: 't3', title: 'Gaming & Hobbies', category: 'General', difficulty: 'Beginner', duration: 5, xp: 15, icon: 'game-controller-outline', desc: 'Discuss your favorite video games, sports, and music bands.' },
    { id: 't4', title: 'Planning a Weekend Outing', category: 'Daily Life', difficulty: 'Intermediate', duration: 6, xp: 20, icon: 'ticket-outline', desc: 'Group chat to pick a movie or visit an amusement park.' },
    { id: 't5', title: 'Asking for Homework Help', category: 'General', difficulty: 'Intermediate', duration: 5, xp: 20, icon: 'book-outline', desc: 'Chat with a classmate or tutor about a tricky science assignment.' },
    { id: 't6', title: 'Shopping for Clothes', category: 'Daily Life', difficulty: 'Beginner', duration: 4, xp: 15, icon: 'shirt-outline', desc: 'Try on cool styles, check shoe sizes, and ask for discounts.' },
    { id: 't7', title: 'Preparing for School Exams', category: 'Career', difficulty: 'Intermediate', duration: 6, xp: 20, icon: 'journal-outline', desc: 'Study session prep and sharing study tips with friends.' },
    { id: 't8', title: 'Joining a High School Club', category: 'General', difficulty: 'Intermediate', duration: 6, xp: 25, icon: 'people-outline', desc: 'Interview for the robotics, drama, or sports club.' },
    { id: 't9', title: 'Talking About Future Dreams', category: 'Career', difficulty: 'Advanced', duration: 7, xp: 30, icon: 'trophy-outline', desc: 'Discuss dream colleges, tech careers, and personal goals.' },
    { id: 't10', title: 'Handling Peer Situations', category: 'General', difficulty: 'Advanced', duration: 7, xp: 30, icon: 'chatbox-ellipses-outline', desc: 'Resolve a misunderstanding with a friend politely.' },
  ],
  'Young Adult': [
    { id: 'y1', title: 'Daily Conversation', category: 'General', difficulty: 'Beginner', duration: 5, xp: 15, icon: 'chatbubbles-outline', desc: 'Chat about campus life, daily habits, and weekend plans.' },
    { id: 'y2', title: 'Campus Coffee Shop', category: 'Daily Life', difficulty: 'Beginner', duration: 4, xp: 15, icon: 'cafe-outline', desc: 'Order artisan coffee, study snacks, and chat with baristas.' },
    { id: 'y3', title: 'College Admission Interview', category: 'Career', difficulty: 'Intermediate', duration: 8, xp: 30, icon: 'school-outline', desc: 'Answer admission questions and explain your choice of major.' },
    { id: 'y4', title: 'Hostel & Roommate Chat', category: 'Daily Life', difficulty: 'Intermediate', duration: 5, xp: 20, icon: 'home-outline', desc: 'Discuss sharing house chores, schedules, and groceries.' },
    { id: 'y5', title: 'Backpacking & Travel', category: 'Travel', difficulty: 'Intermediate', duration: 6, xp: 25, icon: 'airplane-outline', desc: 'Ask for local directions, book hostel beds, and meet travelers.' },
    { id: 'y6', title: 'Part-time Job Interview', category: 'Career', difficulty: 'Intermediate', duration: 7, xp: 25, icon: 'briefcase-outline', desc: 'Practice answering basic interview and customer service questions.' },
    { id: 'y7', title: 'Attending a Tech Fest', category: 'Career', difficulty: 'Intermediate', duration: 6, xp: 25, icon: 'hardware-chip-outline', desc: 'Network with peers and pitch ideas at a campus hackathon.' },
    { id: 'y8', title: 'Renting Your First Apartment', category: 'Daily Life', difficulty: 'Advanced', duration: 7, xp: 30, icon: 'key-outline', desc: 'Talk to a landlord about monthly rent, leases, and utilities.' },
    { id: 'y9', title: 'Group Project Discussion', category: 'General', difficulty: 'Advanced', duration: 8, xp: 35, icon: 'desktop-outline', desc: 'Divide presentation roles and set project deadlines.' },
    { id: 'y10', title: 'Public Speaking & Debate', category: 'Work', difficulty: 'Advanced', duration: 8, xp: 35, icon: 'mic-outline', desc: 'Pitch an argument clearly in a campus debate or presentation.' },
  ],
  Professional: [
    { id: '1', title: 'Daily Conversation', category: 'General', difficulty: 'Beginner', duration: 5, xp: 15, icon: 'chatbubbles-outline', desc: 'Chat about your day, hobbies, and general interests.' },
    { id: '2', title: 'Ordering in Restaurant', category: 'Daily Life', difficulty: 'Beginner', duration: 4, xp: 15, icon: 'restaurant-outline', desc: 'Order food, ask about the menu, and pay the bill.' },
    { id: '3', title: 'Hotel Check-in', category: 'Travel', difficulty: 'Beginner', duration: 5, xp: 20, icon: 'bed-outline', desc: 'Check in, request room services, and ask for local recommendations.' },
    { id: '4', title: 'Airport Customs', category: 'Travel', difficulty: 'Intermediate', duration: 6, xp: 25, icon: 'airplane-outline', desc: 'Declare items, answer security questions, and handle arrivals.' },
    { id: '5', title: 'Shopping Helpers', category: 'Daily Life', difficulty: 'Beginner', duration: 4, xp: 15, icon: 'cart-outline', desc: 'Ask for sizes, negotiate prices, and make payments.' },
    { id: '6', title: 'Office Small Talk', category: 'Work', difficulty: 'Intermediate', duration: 5, xp: 20, icon: 'briefcase-outline', desc: 'Engage with colleagues, discuss weekends, and plan lunches.' },
    { id: '7', title: 'Business Meeting', category: 'Work', difficulty: 'Advanced', duration: 8, xp: 30, icon: 'people-outline', desc: 'Present updates, pitch ideas, and negotiate corporate terms.' },
    { id: '8', title: 'Job Interview Practice', category: 'Career', difficulty: 'Advanced', duration: 10, xp: 40, icon: 'document-text-outline', desc: 'Practice typical HR questions and explain your career goals.' },
    { id: '9', title: 'Salary & Contract Negotiation', category: 'Career', difficulty: 'Advanced', duration: 8, xp: 35, icon: 'cash-outline', desc: 'Negotiate compensation, benefits, and start date.' },
    { id: '10', title: 'Presentation Skills', category: 'Work', difficulty: 'Advanced', duration: 7, xp: 30, icon: 'easel-outline', desc: 'Practice starting, structuring, and concluding a keynote presentation.' },
    { id: '11', title: 'Executive Coaching Session', category: 'Work', difficulty: 'Advanced', duration: 9, xp: 45, icon: 'medal-outline', desc: 'Refine high-level executive communication, leadership tone, and feedback.' },
  ],
  Senior: [
    { id: 's1', title: 'Relaxed Daily Conversation', category: 'General', difficulty: 'Beginner', duration: 5, xp: 15, icon: 'chatbubbles-outline', desc: 'Chat comfortably about morning routines, weather, and life.' },
    { id: 's2', title: 'Tea Time & Gardening', category: 'General', difficulty: 'Beginner', duration: 5, xp: 15, icon: 'leaf-outline', desc: 'Discuss plants, cooking recipes, and home hobbies.' },
    { id: 's3', title: 'Visiting the Pharmacy', category: 'Daily Life', difficulty: 'Beginner', duration: 4, xp: 15, icon: 'medical-outline', desc: 'Ask a pharmacist about prescription directions and advice.' },
    { id: 's4', title: 'Neighborhood Cafe', category: 'Daily Life', difficulty: 'Beginner', duration: 4, xp: 15, icon: 'cafe-outline', desc: 'Order breakfast and chat pleasantly with local staff.' },
    { id: 's5', title: 'Sharing Life Stories', category: 'General', difficulty: 'Intermediate', duration: 7, xp: 25, icon: 'book-outline', desc: 'Tell stories about childhood, family, and past trips.' },
    { id: 's6', title: 'Guided Museum Tour', category: 'Travel', difficulty: 'Intermediate', duration: 6, xp: 25, icon: 'compass-outline', desc: 'Ask a tour guide questions about art, history, and culture.' },
    { id: 's7', title: 'Book & Movie Discussion', category: 'General', difficulty: 'Intermediate', duration: 6, xp: 25, icon: 'film-outline', desc: 'Share thoughts on a favorite novel, movie, or biography.' },
    { id: 's8', title: 'Booking Holiday Travel', category: 'Travel', difficulty: 'Intermediate', duration: 6, xp: 25, icon: 'train-outline', desc: 'Reserve train or plane tickets and ask about senior assistance.' },
    { id: 's9', title: 'Calling Customer Support', category: 'Daily Life', difficulty: 'Intermediate', duration: 5, xp: 20, icon: 'call-outline', desc: 'Get assistance with home internet, TV, or phone service.' },
    { id: 's10', title: 'Family & Grandchildren Chat', category: 'General', difficulty: 'Advanced', duration: 6, xp: 25, icon: 'heart-outline', desc: 'Practice modern terms and catch up with family news.' },
  ],
};

// ─── School Grade Scenarios Data (10 per standard) ─────────────────────────
const STANDARD_SCENARIOS = {
  '1st Std': [
    { id: 'std1_1', title: 'Alphabet Phonics & A-B-C Sounds', category: 'General', difficulty: '1st Std (Starter)', duration: 4, xp: 15, icon: 'color-palette-outline', desc: 'Learn phonics and speak simple words like Apple, Ball, and Cat.' },
    { id: 'std1_2', title: 'Colors & Drawing', category: 'General', difficulty: '1st Std (Starter)', duration: 4, xp: 15, icon: 'brush-outline', desc: 'Describe your favorite colors and what you love to draw.' },
    { id: 'std1_3', title: 'Animal Friends at Zoo & Farm', category: 'Daily Life', difficulty: '1st Std (Starter)', duration: 5, xp: 15, icon: 'paw-outline', desc: 'Talk about lions, monkeys, dogs, and cows with your AI teacher.' },
    { id: 'std1_4', title: 'Friendly School Greetings', category: 'Daily Life', difficulty: '1st Std (Starter)', duration: 4, xp: 15, icon: 'hand-left-outline', desc: 'Say Good Morning, Hello Teacher, and Thank You at school.' },
    { id: 'std1_5', title: 'My Body Parts & Clean Habits', category: 'General', difficulty: '1st Std (Starter)', duration: 4, xp: 15, icon: 'happy-outline', desc: 'Learn and speak names of eyes, ears, hands, and feet.' },
    { id: 'std1_6', title: 'My Family Members & Home', category: 'Daily Life', difficulty: '1st Std (Starter)', duration: 4, xp: 15, icon: 'heart-outline', desc: 'Introduce your Father, Mother, Brother, and Sister in simple sentences.' },
    { id: 'std1_7', title: 'Counting Numbers & My Toys', category: 'General', difficulty: '1st Std (Starter)', duration: 4, xp: 15, icon: 'shapes-outline', desc: 'Practice counting toys and numbers 1 to 20 out loud.' },
    { id: 'std1_8', title: 'My Favorite Fruits & Vegetables', category: 'Daily Life', difficulty: '1st Std (Starter)', duration: 4, xp: 15, icon: 'nutrition-outline', desc: 'Talk about sweet apples, bananas, and healthy carrots.' },
    { id: 'std1_9', title: 'Vehicles & Road Sounds', category: 'General', difficulty: '1st Std (Starter)', duration: 4, xp: 15, icon: 'car-outline', desc: 'Name cars, buses, trains, and bicycles with fun sounds.' },
    { id: 'std1_10', title: 'Good Night & Bedtime Routine', category: 'Daily Life', difficulty: '1st Std (Starter)', duration: 4, xp: 15, icon: 'moon-outline', desc: 'Describe brushing teeth, saying good night, and sweet dreams.' },
  ],
  '2nd Std': [
    { id: 'std2_1', title: 'Classroom Objects & Tools', category: 'General', difficulty: '2nd Std (Elementary)', duration: 4, xp: 15, icon: 'school-outline', desc: 'Name pencils, erasers, notebooks, rulers, and school bags.' },
    { id: 'std2_2', title: 'My Daily Morning Routine', category: 'Daily Life', difficulty: '2nd Std (Elementary)', duration: 5, xp: 15, icon: 'sunny-outline', desc: 'Describe waking up, brushing teeth, and eating breakfast.' },
    { id: 'std2_3', title: 'Weather & Clothes Today', category: 'Daily Life', difficulty: '2nd Std (Elementary)', duration: 4, xp: 15, icon: 'rainy-outline', desc: 'Talk about sunny, rainy, and cold days and what you wear.' },
    { id: 'std2_4', title: 'Ordering Ice Cream & Snacks', category: 'Daily Life', difficulty: '2nd Std (Elementary)', duration: 4, xp: 15, icon: 'ice-cream-outline', desc: 'Practice ordering chocolate, vanilla, and fruit scoops politely.' },
    { id: 'std2_5', title: 'Toys & Playground Games', category: 'General', difficulty: '2nd Std (Elementary)', duration: 5, xp: 15, icon: 'football-outline', desc: 'Invite friends to play on swings, slides, and football ground.' },
    { id: 'std2_6', title: 'Expressing My Feelings & Moods', category: 'Daily Life', difficulty: '2nd Std (Elementary)', duration: 4, xp: 15, icon: 'chatbubble-ellipses-outline', desc: 'Practice saying "I am happy", "I am tired", and "I like reading".' },
    { id: 'std2_7', title: 'Shapes & Building Blocks', category: 'General', difficulty: '2nd Std (Elementary)', duration: 4, xp: 15, icon: 'cube-outline', desc: 'Talk about circles, squares, triangles, and lego blocks.' },
    { id: 'std2_8', title: 'My Pet & Animal Kindness', category: 'General', difficulty: '2nd Std (Elementary)', duration: 5, xp: 15, icon: 'heart-circle-outline', desc: 'Describe your pet and how to show love and kindness to animals.' },
    { id: 'std2_9', title: 'Magic Words & Politeness', category: 'Daily Life', difficulty: '2nd Std (Elementary)', duration: 4, xp: 15, icon: 'sparkles-outline', desc: 'Master polite phrases like "Please", "Sorry", and "Excuse me".' },
    { id: 'std2_10', title: 'Birthday Party Celebration', category: 'Daily Life', difficulty: '2nd Std (Elementary)', duration: 5, xp: 15, icon: 'gift-outline', desc: 'Wish happy birthday, blow candles, and discuss fun party games.' },
  ],
  '3rd Std': [
    { id: 'std3_1', title: 'Action Verbs & Activities', category: 'General', difficulty: '3rd Std (Upper Elem)', duration: 5, xp: 20, icon: 'flash-outline', desc: 'Speak using action words like running, jumping, writing, and singing.' },
    { id: 'std3_2', title: 'Friendly Doctor Visit', category: 'Daily Life', difficulty: '3rd Std (Upper Elem)', duration: 5, xp: 20, icon: 'medkit-outline', desc: 'Explain symptoms ("I have a fever", "My arm hurts") to a doctor.' },
    { id: 'std3_3', title: 'Community Helpers & Jobs', category: 'General', difficulty: '3rd Std (Upper Elem)', duration: 5, xp: 20, icon: 'people-outline', desc: 'Talk about doctors, firefighters, police officers, and teachers.' },
    { id: 'std3_4', title: 'Telling Clock Time & Schedules', category: 'Daily Life', difficulty: '3rd Std (Upper Elem)', duration: 4, xp: 15, icon: 'time-outline', desc: 'Practice saying time ("It is 8 o\'clock", "Time for dinner").' },
    { id: 'std3_5', title: 'Stationery Shop Polite Buying', category: 'Daily Life', difficulty: '3rd Std (Upper Elem)', duration: 4, xp: 15, icon: 'create-outline', desc: 'Ask shopkeepers for pencils, paper, and crayons politely.' },
    { id: 'std3_6', title: 'My Favorite Storybook & Hero', category: 'General', difficulty: '3rd Std (Upper Elem)', duration: 5, xp: 20, icon: 'book-outline', desc: 'Tell your AI teacher about a superhero or fairytale story you read.' },
    { id: 'std3_7', title: 'Healthy Food & Canteen Snacks', category: 'Daily Life', difficulty: '3rd Std (Upper Elem)', duration: 4, xp: 15, icon: 'restaurant-outline', desc: 'Discuss fruits, vegetables, and canteen lunch items.' },
    { id: 'std3_8', title: 'Seasons & Indian Festivals', category: 'General', difficulty: '3rd Std (Upper Elem)', duration: 5, xp: 20, icon: 'sunny-outline', desc: 'Talk about summer holidays, Diwali, Christmas, and rain.' },
    { id: 'std3_9', title: 'Visiting the Zoo Guide', category: 'Travel', difficulty: '3rd Std (Upper Elem)', duration: 5, xp: 20, icon: 'compass-outline', desc: 'Ask questions to a zookeeper about wild animals.' },
    { id: 'std3_10', title: 'Classroom Helper & Desk Care', category: 'Daily Life', difficulty: '3rd Std (Upper Elem)', duration: 5, xp: 20, icon: 'hand-left-outline', desc: 'Help the teacher distribute books and keep desks tidy.' },
  ],
  '4th Std': [
    { id: 'std4_1', title: 'School Canteen Order', category: 'Daily Life', difficulty: '4th Std (Pre-Interm)', duration: 5, xp: 20, icon: 'restaurant-outline', desc: 'Order lunch, ask for water, and calculate coins politely.' },
    { id: 'std4_2', title: 'Asking Directions at School', category: 'Daily Life', difficulty: '4th Std (Pre-Interm)', duration: 5, xp: 20, icon: 'compass-outline', desc: 'Ask where the library, computer lab, or sports ground is.' },
    { id: 'std4_3', title: 'Solar System & Space Rocket Journey', category: 'General', difficulty: '4th Std (Pre-Interm)', duration: 6, xp: 25, icon: 'planet-outline', desc: 'Explore Earth, Moon, Mars, and rockets with your space buddy.' },
    { id: 'std4_4', title: 'Describing My Hometown & Landmarks', category: 'General', difficulty: '4th Std (Pre-Interm)', duration: 5, xp: 20, icon: 'business-outline', desc: 'Describe your city, famous parks, and landmarks.' },
    { id: 'std4_5', title: 'Visiting Grandpa\'s Farm & Crops', category: 'Travel', difficulty: '4th Std (Pre-Interm)', duration: 5, xp: 20, icon: 'leaf-outline', desc: 'Describe tractors, cows, fresh milk, and farm animals.' },
    { id: 'std4_6', title: 'Healthy Habits & Outdoor Sports', category: 'Daily Life', difficulty: '4th Std (Pre-Interm)', duration: 5, xp: 20, icon: 'trophy-outline', desc: 'Discuss eating vegetables, drinking water, and outdoor sports.' },
    { id: 'std4_7', title: 'Comparing Animal Sizes & Speeds', category: 'General', difficulty: '4th Std (Pre-Interm)', duration: 5, xp: 20, icon: 'bar-chart-outline', desc: 'Practice comparative words (bigger, faster, taller) with animals.' },
    { id: 'std4_8', title: 'Past Weekend Family Outing', category: 'Daily Life', difficulty: '4th Std (Pre-Interm)', duration: 6, xp: 25, icon: 'car-sport-outline', desc: 'Use simple past tense to describe a family outing.' },
    { id: 'std4_9', title: 'My Hobbies & Creative Talents', category: 'General', difficulty: '4th Std (Pre-Interm)', duration: 5, xp: 20, icon: 'color-palette-outline', desc: 'Talk about drawing, singing, playing cricket, or reading.' },
    { id: 'std4_10', title: 'School Library Book Borrowing', category: 'General', difficulty: '4th Std (Pre-Interm)', duration: 5, xp: 20, icon: 'library-outline', desc: 'Ask the librarian to borrow adventure or science books.' },
  ],
  '5th Std': [
    { id: 'std5_1', title: 'First Day in 5th Grade', category: 'General', difficulty: '5th Std (Intermediate)', duration: 5, xp: 20, icon: 'school-outline', desc: 'Introduce yourself to new classmates and talk about favorite subjects.' },
    { id: 'std5_2', title: 'Planning a Class Picnic', category: 'Daily Life', difficulty: '5th Std (Intermediate)', duration: 6, xp: 25, icon: 'sunny-outline', desc: 'Discuss picnic spots, sports games, and group snacks with friends.' },
    { id: 'std5_3', title: 'Science Project Idea Pitch', category: 'General', difficulty: '5th Std (Intermediate)', duration: 6, xp: 25, icon: 'hardware-chip-outline', desc: 'Explain your science project model (volcano, solar system, plants).' },
    { id: 'std5_4', title: 'Storybook Character Review', category: 'General', difficulty: '5th Std (Intermediate)', duration: 6, xp: 25, icon: 'journal-outline', desc: 'Describe the main hero, plot, and moral of a story you read.' },
    { id: 'std5_5', title: 'Environmental Care & Trees', category: 'Daily Life', difficulty: '5th Std (Intermediate)', duration: 5, xp: 20, icon: 'earth-outline', desc: 'Talk about planting trees, recycling paper, and keeping school clean.' },
    { id: 'std5_6', title: 'Planning a Weekend Trip', category: 'Travel', difficulty: '5th Std (Intermediate)', duration: 6, xp: 25, icon: 'map-outline', desc: 'Plan a trip to a museum or beach using future tense (will, going to).' },
    { id: 'std5_7', title: 'School Bus Friendship & Ride', category: 'Daily Life', difficulty: '5th Std (Intermediate)', duration: 5, xp: 20, icon: 'bus-outline', desc: 'Chat with bus mates and discuss road and bus safety rules.' },
    { id: 'std5_8', title: 'Annual Sports Meet Cheering', category: 'General', difficulty: '5th Std (Intermediate)', duration: 6, xp: 25, icon: 'trophy-outline', desc: 'Cheer for your school house team and celebrate sportsmanship.' },
    { id: 'std5_9', title: 'Supermarket Polite Shopping', category: 'Daily Life', difficulty: '5th Std (Intermediate)', duration: 5, xp: 20, icon: 'cart-outline', desc: 'Check grocery lists, ask prices, and handle counter billing.' },
    { id: 'std5_10', title: 'My Dream Career & Ambition', category: 'Career', difficulty: '5th Std (Intermediate)', duration: 6, xp: 25, icon: 'star-outline', desc: 'Explain why you want to become a scientist, pilot, doctor, or artist.' },
  ],
  '6th Std': [
    { id: 'std6_1', title: 'Asking Teacher Homework Help', category: 'Daily Life', difficulty: '6th Std (Upper Interm)', duration: 5, xp: 20, icon: 'create-outline', desc: 'Politely ask your teacher to clarify math equations or history notes.' },
    { id: 'std6_2', title: 'Robotics & Science Club Interview', category: 'General', difficulty: '6th Std (Upper Interm)', duration: 6, xp: 25, icon: 'hardware-chip-outline', desc: 'Present your project idea and interview for the school robotics club.' },
    { id: 'std6_3', title: 'Annual Sports Day Commentary', category: 'General', difficulty: '6th Std (Upper Interm)', duration: 6, xp: 25, icon: 'trophy-outline', desc: 'Practice live commentary for relay races and football finals.' },
    { id: 'std6_4', title: 'Shopping for Clothes & Shoe Sizing', category: 'Daily Life', difficulty: '6th Std (Upper Interm)', duration: 5, xp: 20, icon: 'shirt-outline', desc: 'Try on shoes, check sizes, and ask sales staff for assistance.' },
    { id: 'std6_5', title: 'School Debate: Daily Homework', category: 'General', difficulty: '6th Std (Upper Interm)', duration: 6, xp: 25, icon: 'chatbubbles-outline', desc: 'Formulate persuasive arguments for and against weekend homework.' },
    { id: 'std6_6', title: 'Library Book & Mystery Recommendation', category: 'General', difficulty: '6th Std (Upper Interm)', duration: 6, xp: 25, icon: 'book-outline', desc: 'Recommend a mystery or adventure book to a classmate.' },
    { id: 'std6_7', title: 'Computer Lab, Coding & Internet Safety', category: 'Work', difficulty: '6th Std (Upper Interm)', duration: 6, xp: 25, icon: 'desktop-outline', desc: 'Talk about typing skills, Scratch programming, and internet safety.' },
    { id: 'std6_8', title: 'Preparing for Unit Tests & Revision', category: 'Daily Life', difficulty: '6th Std (Upper Interm)', duration: 5, xp: 20, icon: 'pencil-outline', desc: 'Discuss study timetables and revision strategies with classmates.' },
    { id: 'std6_9', title: 'Daily Habits & Present Perfect Tense Practice', category: 'General', difficulty: '6th Std (Upper Interm)', duration: 6, xp: 25, icon: 'checkmark-circle-outline', desc: 'Use present perfect structures ("I have completed", "She has visited").' },
    { id: 'std6_10', title: 'School Exhibition Guide Presentation', category: 'General', difficulty: '6th Std (Upper Interm)', duration: 6, xp: 25, icon: 'easel-outline', desc: 'Welcome guests and guide them through class science stalls.' },
  ],
  '7th Std': [
    { id: 'std7_1', title: 'Group Discussion: Water Conservation & Climate', category: 'General', difficulty: '7th Std (Intermediate)', duration: 7, xp: 30, icon: 'water-outline', desc: 'Participate in a group discussion on saving water and global warming.' },
    { id: 'std7_2', title: 'Science Fair Exhibition Project Presentation', category: 'General', difficulty: '7th Std (Intermediate)', duration: 7, xp: 30, icon: 'flash-outline', desc: 'Present your renewable energy or robotics model to judges.' },
    { id: 'std7_3', title: 'Movie & Book Critical Review', category: 'General', difficulty: '7th Std (Intermediate)', duration: 6, xp: 25, icon: 'film-outline', desc: 'Analyze characters, climax, cinematography, and moral lessons.' },
    { id: 'std7_4', title: 'Debate: Smartphones in Classrooms', category: 'General', difficulty: '7th Std (Intermediate)', duration: 7, xp: 30, icon: 'phone-portrait-outline', desc: 'Debate pros and cons of digital learning vs classroom distraction.' },
    { id: 'std7_5', title: 'Organizing School Cultural Festival', category: 'Daily Life', difficulty: '7th Std (Intermediate)', duration: 8, xp: 30, icon: 'musical-notes-outline', desc: 'Delegate tasks for stage decor, dance routines, and ticket sales.' },
    { id: 'std7_6', title: 'School Heritage Field Trip & Monuments', category: 'Travel', difficulty: '7th Std (Intermediate)', duration: 6, xp: 25, icon: 'trail-sign-outline', desc: 'Ask tour guides detailed questions about historical monuments.' },
    { id: 'std7_7', title: 'Asking Directions in an Unknown City', category: 'Travel', difficulty: '7th Std (Intermediate)', duration: 6, xp: 25, icon: 'navigate-outline', desc: 'Ask locals for subway lines, bus stands, and historic landmarks.' },
    { id: 'std7_8', title: 'Student Council Campaign Election Speech', category: 'Career', difficulty: '7th Std (Intermediate)', duration: 8, xp: 35, icon: 'mic-outline', desc: 'Deliver a campaign speech for Class Captain or Sports Prefect.' },
    { id: 'std7_9', title: 'Polite Formal Requests & Phrasing', category: 'Daily Life', difficulty: '7th Std (Intermediate)', duration: 7, xp: 25, icon: 'chatbox-ellipses-outline', desc: 'Refined polite phrases ("Could you please...", "I would appreciate...").' },
    { id: 'std7_10', title: 'Historical Figures & Public Speech', category: 'General', difficulty: '7th Std (Intermediate)', duration: 7, xp: 30, icon: 'easel-outline', desc: 'Deliver a short presentation on a famous inventor or leader.' },
  ],
  '8th Std': [
    { id: 'std8_1', title: 'Inter-School Debate: Social Media vs Books', category: 'General', difficulty: '8th Std (Upper Interm)', duration: 8, xp: 35, icon: 'chatbubbles-outline', desc: 'Present strong arguments and counter-rebuttals on social issues.' },
    { id: 'std8_2', title: 'Artificial Intelligence & Future Tech Innovations', category: 'Work', difficulty: '8th Std (Upper Interm)', duration: 7, xp: 30, icon: 'hardware-chip-outline', desc: 'Discuss artificial intelligence, space probes, and future tech.' },
    { id: 'std8_3', title: 'Student Council Leadership & House Meeting', category: 'Career', difficulty: '8th Std (Upper Interm)', duration: 8, xp: 35, icon: 'people-outline', desc: 'Lead house meetings, organize events, and address student queries.' },
    { id: 'std8_4', title: 'Planning a Community Charity Campaign', category: 'Daily Life', difficulty: '8th Std (Upper Interm)', duration: 8, xp: 30, icon: 'heart-outline', desc: 'Pitch ideas for helping local shelters and organizing donation drives.' },
    { id: 'std8_5', title: 'High School Electives & Stream Selection', category: 'Career', difficulty: '8th Std (Upper Interm)', duration: 6, xp: 25, icon: 'school-outline', desc: 'Discuss choosing Science, Commerce, Arts, or Vocational streams.' },
    { id: 'std8_6', title: 'Formal Email Writing & Out-Loud Speech', category: 'Daily Life', difficulty: '8th Std (Upper Interm)', duration: 7, xp: 30, icon: 'mail-outline', desc: 'Practice speaking out loud a formal request email to your principal.' },
    { id: 'std8_7', title: 'School Magazine Article Editorial Pitch', category: 'General', difficulty: '8th Std (Upper Interm)', duration: 7, xp: 30, icon: 'newspaper-outline', desc: 'Pitch an editorial article on mental health or youth hobbies.' },
    { id: 'std8_8', title: 'Career Aspirations & 10-Year Goals', category: 'Career', difficulty: '8th Std (Upper Interm)', duration: 8, xp: 35, icon: 'briefcase-outline', desc: 'Discuss career paths in Engineering, Medicine, Arts, and Tech.' },
    { id: 'std8_9', title: 'Mock Model United Nations (MUN) Resolution', category: 'General', difficulty: '8th Std (Upper Interm)', duration: 9, xp: 40, icon: 'globe-outline', desc: 'Represent a country delegate and present formal resolution speeches.' },
    { id: 'std8_10', title: 'Overcoming Stage Fear & Confident Body Language', category: 'General', difficulty: '8th Std (Upper Interm)', duration: 7, xp: 30, icon: 'body-outline', desc: 'Master confident eye contact, breath control, and vocal projection.' },
  ],
  '9th Std': [
    { id: 'std9_1', title: 'Mock High School & Academic Admission Interview', category: 'Career', difficulty: '9th Std (Advanced)', duration: 8, xp: 40, icon: 'school-outline', desc: 'Practice formal interview questions for high school admissions.' },
    { id: 'std9_2', title: 'Keynote Speech: Global Climate Action', category: 'Career', difficulty: '9th Std (Advanced)', duration: 8, xp: 40, icon: 'leaf-outline', desc: 'Deliver a structured keynote address on renewable energy.' },
    { id: 'std9_3', title: 'Keynote Speech: Youth Leadership & Innovation', category: 'Career', difficulty: '9th Std (Advanced)', duration: 8, xp: 40, icon: 'megaphone-outline', desc: 'Deliver an inspiring keynote speech to a school auditorium.' },
    { id: 'std9_4', title: 'Debate: Digital vs Physical Schooling', category: 'General', difficulty: '9th Std (Advanced)', duration: 8, xp: 35, icon: 'easel-outline', desc: 'Argue the pros and cons of online learning vs physical classrooms.' },
    { id: 'std9_5', title: 'Academic Essay Thesis & Oral Defense', category: 'General', difficulty: '9th Std (Advanced)', duration: 7, xp: 35, icon: 'document-text-outline', desc: 'Defend your research paper thesis and answer teacher questions.' },
    { id: 'std9_6', title: 'Resolving Peer Conflict Diplomatic Skills', category: 'Daily Life', difficulty: '9th Std (Advanced)', duration: 8, xp: 30, icon: 'people-outline', desc: 'Handle interpersonal disagreements constructively using polite language.' },
    { id: 'std9_7', title: 'STEM & Tech Career Roadmaps', category: 'Career', difficulty: '9th Std (Advanced)', duration: 8, xp: 40, icon: 'rocket-outline', desc: 'Discuss engineering, medical, coding, and finance career paths.' },
    { id: 'std9_8', title: 'Current World Affairs & Scientific Discoveries', category: 'General', difficulty: '9th Std (Advanced)', duration: 8, xp: 35, icon: 'planet-outline', desc: 'Discuss recent scientific discoveries, space missions, and global news.' },
    { id: 'std9_9', title: 'Formal Email & Request to School Principal', category: 'Work', difficulty: '9th Std (Advanced)', duration: 6, xp: 30, icon: 'mail-outline', desc: 'Request event permissions and venue bookings in formal tone.' },
    { id: 'std9_10', title: 'Advanced Rhetoric, Native Idioms & Transitions', category: 'General', difficulty: '9th Std (Advanced)', duration: 8, xp: 40, icon: 'ribbon-outline', desc: 'Incorporate sophisticated vocabulary and persuasive transitions.' },
  ],
  '10th Std': [
    { id: 'std10_1', title: '10th Board Oral Exam Simulation', category: 'Career', difficulty: '10th Std (Board Prep)', duration: 10, xp: 50, icon: 'document-text-outline', desc: 'Simulate official 10th Board oral examination with strict feedback.' },
    { id: 'std10_2', title: 'College Major & Career Pathway Pitch', category: 'Career', difficulty: '10th Std (Board Prep)', duration: 8, xp: 40, icon: 'briefcase-outline', desc: 'Pitch your chosen career roadmap in Engineering, Medicine, Arts, or Tech.' },
    { id: 'std10_3', title: 'Public Keynote & Q&A Defense Strategy', category: 'Work', difficulty: '10th Std (Board Prep)', duration: 9, xp: 45, icon: 'megaphone-outline', desc: 'Deliver a persuasive speech and answer challenging follow-up questions.' },
    { id: 'std10_4', title: 'Global Youth Leadership Summit & Policy', category: 'General', difficulty: '10th Std (Board Prep)', duration: 10, xp: 50, icon: 'earth-outline', desc: 'Discuss international relations, innovation, and youth leadership.' },
    { id: 'std10_5', title: 'Native Idioms & Advanced Phrasal Verbs', category: 'General', difficulty: '10th Std (Board Prep)', duration: 8, xp: 40, icon: 'ribbon-outline', desc: 'Master incorporating native idioms and expressions into speeches.' },
    { id: 'std10_6', title: 'CEFR C1 Level Spontaneous Oratory Mastery', category: 'Work', difficulty: '10th Std (Board Prep)', duration: 10, xp: 50, icon: 'star-outline', desc: 'Master persuasive rhetoric, tone modulation, and spontaneous fluency.' },
    { id: 'std10_7', title: 'Group Discussion: Ethics in Artificial Intelligence', category: 'General', difficulty: '10th Std (Board Prep)', duration: 9, xp: 45, icon: 'hardware-chip-outline', desc: 'Discuss AI bias, deepfakes, automation, and privacy ethics.' },
    { id: 'std10_8', title: 'Internship & Apprenticeship Interview Simulation', category: 'Career', difficulty: '10th Std (Board Prep)', duration: 9, xp: 45, icon: 'briefcase-outline', desc: 'Answer behavioral interview questions using the structured STAR method.' },
    { id: 'std10_9', title: 'Critical Thinking: Analyzing News & Misinformation', category: 'General', difficulty: '10th Std (Board Prep)', duration: 8, xp: 40, icon: 'newspaper-outline', desc: 'Detect biases, media spin, and present fact-based arguments.' },
    { id: 'std10_10', title: 'Valedictory Farewell Speech to School', category: 'Work', difficulty: '10th Std (Board Prep)', duration: 10, xp: 50, icon: 'school-outline', desc: 'Deliver an eloquent, emotional farewell speech to teachers and juniors.' },
  ],
};

const CATEGORIES = ['All', 'General', 'Daily Life', 'Travel', 'Work', 'Career'];

const DIFF_COLORS = {
  Beginner: { bg: '#DCFCE7', text: '#16A34A' },
  Intermediate: { bg: '#FEF9C3', text: '#CA8A04' },
  Advanced: { bg: '#FEE2E2', text: '#DC2626' },
};

export const getScenarioInitialGreeting = (title = '') => {
  const t = title.toLowerCase();

  // Kids Scenarios
  if (t.includes('show & tell') || t.includes('superhero') || t.includes('favorite toy')) {
    return "Hi there! I am so excited for Show and Tell today! What awesome toy, superhero, or story do you want to share with me?";
  } else if (t.includes('zoo') || t.includes('animal friends') || t.includes('zoo guide')) {
    return "Hello! Welcome to the city zoo! We have roaring lions, playful monkeys, and huge elephants. What animal do you want to visit first?";
  } else if (t.includes('ice cream')) {
    return "Hi! Welcome to the ice cream parlor! We have delicious chocolate, creamy vanilla, and fresh strawberry. What flavor would you like?";
  } else if (t.includes('school lunch') || t.includes('canteen')) {
    return "Hey! Welcome to lunchtime. I have a tasty sandwich and fruit juice today. What did you bring for lunch?";
  } else if (t.includes('space adventure') || t.includes('space rocket')) {
    return "Greetings, astronaut! We are about to launch our rocket into outer space. Are you ready for countdown in 3, 2, 1?";
  } else if (t.includes('park') || t.includes('playground') || t.includes('swings')) {
    return "Hello friend! The weather is so nice at the park. Do you want to play on the swings or kick the football first?";
  } else if (t.includes('birthday party')) {
    return "Happy Birthday! Welcome to the celebration! Would you like some cake, or should we play party games first?";
  } else if (t.includes('doctor') || t.includes('pharmacy') || t.includes('health')) {
    return "Hello! Come on in and have a seat. How are you feeling today, and how can I help you feel better?";
  } else if (t.includes('bedtime story')) {
    return "Good evening! Let's create a wonderful bedtime adventure story together. Once upon a time, where should our journey begin?";
  }

  // School Standards (1st - 10th Std)
  else if (t.includes('alphabet') || t.includes('phonics') || t.includes('sounds fun')) {
    return "Hello young learner! Welcome to fun with letters and sounds. Which letter of the alphabet is your favorite?";
  } else if (t.includes('colors & drawing')) {
    return "Hello artist! I love drawing and painting. What bright colors do you like to color your pictures with?";
  } else if (t.includes('counting numbers') || t.includes('numbers & my toys')) {
    return "Hello! Let's practice numbers and counting. Can you count from one to ten with me?";
  } else if (t.includes('fruits & vegetables')) {
    return "Hello! Fruits and vegetables keep us strong and healthy. What is your favorite fruit to eat?";
  } else if (t.includes('shapes & building')) {
    return "Hello! Look at these fun building blocks and shapes. Can you spot a circle, a square, or a triangle?";
  } else if (t.includes('animal kindness') || t.includes('my pet')) {
    return "Hello! Animals are gentle friends. Do you have a pet at home or an animal you love caring for?";
  } else if (t.includes('school greetings') || t.includes('morning routine')) {
    return "Good morning! It is wonderful to see you today. How did you start your morning routine before coming to school?";
  } else if (t.includes('classroom objects') || t.includes('stationery')) {
    return "Good day! Welcome to our classroom. Could you tell me what stationery items you have in your school bag today?";
  } else if (t.includes('library book borrowing') || t.includes('school library')) {
    return "Welcome to the school library! Shh... What kind of book are you looking to borrow today?";
  } else if (t.includes('supermarket') || t.includes('grocery store')) {
    return "Welcome to the supermarket! Here is your shopping cart. What items are on our shopping list today?";
  } else if (t.includes('science project') || t.includes('robotics')) {
    return "Welcome to the science and innovation lab! What exciting project or model are you preparing to demonstrate?";
  } else if (t.includes('water conservation') || t.includes('environmental care') || t.includes('climate')) {
    return "Hello! Thank you for joining our environmental session. In your opinion, what is the best way we can save water and protect nature?";
  } else if (t.includes('stage fear') || t.includes('body language')) {
    return "Welcome! Speaking confidently in front of an audience is a superpower. Let's take a deep breath together. What is your speech about?";
  } else if (t.includes('debate')) {
    return "Welcome to today's formal debate session. The floor is yours—please present your opening statement on the topic.";
  } else if (t.includes('news & misinformation') || t.includes('critical thinking')) {
    return "Welcome to critical media analysis. Today we examine how to distinguish verified facts from misleading claims. What news topic shall we analyze?";
  } else if (t.includes('student council') || t.includes('leadership')) {
    return "Welcome candidate! Thank you for stepping up for student council leadership. What positive changes do you plan to bring to our school?";
  } else if (t.includes('farewell speech') || t.includes('valedictory')) {
    return "Welcome! Delivering a school farewell speech is a proud milestone. Who would you like to thank in your speech?";
  } else if (t.includes('ethics in artificial intelligence') || t.includes('artificial intelligence')) {
    return "Welcome to our group discussion on Artificial Intelligence. How do you think AI should be used responsibly in education and everyday life?";
  } else if (t.includes('board oral exam') || t.includes('oratory mastery') || t.includes('keynote')) {
    return "Welcome to the formal oral examination. Please begin by introducing yourself and stating your primary speaking topic.";
  }

  // Teens & Young Adults
  else if (t.includes('high school') || t.includes('first day')) {
    return "Hey! Welcome to the new school term. I'm excited to be your classmate! How has your first day been going so far?";
  } else if (t.includes('fast food') || t.includes('burger')) {
    return "Hey! Welcome to Burger Express. Are you ready to order, or would you like to check out our combo meals today?";
  } else if (t.includes('gaming') || t.includes('hobbies')) {
    return "Hey there! It's great to connect. What video games, music, or hobbies have you been enjoying recently?";
  } else if (t.includes('homework help')) {
    return "Hi! Don't worry, we can work through this assignment together. Which question or topic is giving you trouble?";
  } else if (t.includes('coffee') || t.includes('cafe')) {
    return "Hi there! Welcome to the cafe. What specialty coffee or tea can I brew for you today?";
  } else if (t.includes('hotel') || t.includes('check-in')) {
    return "Good day and welcome to our hotel! Are you checking in under a reservation today?";
  } else if (t.includes('airport') || t.includes('customs') || t.includes('backpacking')) {
    return "Good day! Welcome to airport check-in. May I see your passport and travel documents, please?";
  } else if (t.includes('job interview') || t.includes('admission interview') || t.includes('part-time job')) {
    return "Welcome and thank you for meeting with us today! To begin, could you please introduce yourself and tell us what interests you about this role?";
  } else if (t.includes('roommate') || t.includes('hostel') || t.includes('apartment')) {
    return "Hi there! It's great to meet you. Shall we discuss our room layout, shared chores, and daily schedules?";
  } else if (t.includes('restaurant') || t.includes('dining') || t.includes('food')) {
    return "Hello! Welcome to our restaurant. Can I get a table ready for you, or would you like to see our dinner menu?";
  } else if (t.includes('shopping') || t.includes('clothes') || t.includes('store')) {
    return "Hi! Welcome to our store. Are you looking for a specific size, color, or style today?";
  }

  // Professionals & Seniors
  else if (t.includes('executive coaching')) {
    return "Welcome to our executive coaching session. Let's discuss your strategic leadership vision, executive presence, and key management decisions.";
  } else if (t.includes('office small talk') || t.includes('business meeting')) {
    return "Good morning! Thank you for joining our session today. Shall we review the key project milestones and agenda items?";
  } else if (t.includes('salary') || t.includes('contract negotiation')) {
    return "Good afternoon. Thank you for taking the time to discuss the offer. What aspects of the compensation package would you like to review?";
  } else if (t.includes('presentation skills')) {
    return "Welcome! The stage is set for your presentation. Whenever you're ready, please deliver your opening hook and slide overview.";
  } else if (t.includes('tea time') || t.includes('gardening')) {
    return "Good afternoon! A warm cup of tea is ready. How are your garden plants and home projects doing these days?";
  } else if (t.includes('museum tour') || t.includes('life stories')) {
    return "Welcome to the guided cultural tour! We have fascinating historical exhibits ahead. What period of history interests you most?";
  } else if (t.includes('customer support')) {
    return "Hello! Thank you for calling customer support. My name is Alex. How may I assist you with your account today?";
  } else if (t.includes('daily conversation') || t.includes('relaxed daily')) {
    return "Hello! Welcome to our daily conversation practice. How has your day been going so far?";
  }

  const cleanTitle = (title || '').replace(/\b(conversation|practice|session)\b/gi, '').trim();
  const scenarioLabel = cleanTitle ? `${cleanTitle} ` : '';
  return `Hello! Welcome to our ${scenarioLabel}conversation practice. How can I assist you today?`;
};

let cachedMobileSpeakingHistory = null;
const SPEAKING_HISTORY_KEY = 'speakmate_speaking_history_cache';

export default function SpeakingHomeScreen({ navigation }) {
  const { isDark, theme } = useTheme();
  const { showToast } = useToast();
  const { user } = useAuth();

  const [history, setHistory] = useState(() => cachedMobileSpeakingHistory || []);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedGrade, setSelectedGrade] = useState(() => user?.schoolGrade || '1st Std');
  const [userAgeGroup, setUserAgeGroup] = useState(() => user?.ageGroup || 'Professional');
  const [accountType, setAccountType] = useState(() => user?.accountType || (user?.schoolGrade ? 'STUDENT' : 'INDIVIDUAL_USER'));
  const [activeAvatarModel, setActiveAvatarModel] = useState(() => getCachedAvatarModel() || 'haru');

  // Immediate cached disk read on first load
  useEffect(() => {
    AsyncStorage.getItem('speakmate_speaking_category').then((savedCat) => {
      if (savedCat) setSelectedCategory(savedCat);
    }).catch(() => {});

    AsyncStorage.getItem(SPEAKING_HISTORY_KEY).then((raw) => {
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            cachedMobileSpeakingHistory = parsed;
            setHistory(parsed);
          }
        } catch {}
      }
    }).catch(() => {});
  }, []);

  // Sync profile when user updates
  useEffect(() => {
    if (user?.schoolGrade) setSelectedGrade(user.schoolGrade);
    if (user?.ageGroup) setUserAgeGroup(user.ageGroup);
    if (user?.accountType) setAccountType(user.accountType);
  }, [user?.schoolGrade, user?.ageGroup, user?.accountType]);

  // Stats calculation - strictly speaking-specific metrics (speaking practice minutes & speaking session XP)
  const dashData = DashboardCache.get(user?.id);
  const totalMinutes = Math.round(history.reduce((sum, item) => sum + (item.duration || 0), 0) / 60);
  const totalXP = history.reduce((sum, item) => sum + (item.xpEarned || 0), 0);
  const totalSessions = history.length;
  const streak = Number(dashData?.progress?.currentStreak || dashData?.profile?.streak || (history.length > 0 ? 3 : 0));

  const loadData = async (silent = false) => {
    try {
      const rawHistory = await speakingService.history().catch(() => []);
      const validHistory = Array.isArray(rawHistory)
        ? rawHistory.filter(item => item && (item.completed === true || item.status === 'COMPLETED' || (item.duration && item.duration > 0 && (item.overallScore > 0 || item.score > 0))))
        : [];
      setHistory(validHistory);
      cachedMobileSpeakingHistory = validHistory;
      AsyncStorage.setItem(SPEAKING_HISTORY_KEY, JSON.stringify(validHistory)).catch(() => {});

      if (user?.accountType) setAccountType(user.accountType);
      if (user?.schoolGrade) setSelectedGrade(user.schoolGrade);
      if (user?.ageGroup) setUserAgeGroup(user.ageGroup);
    } catch (e) {
      console.warn('Failed to load speaking dashboard data', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData(true);
      const cached = getCachedAvatarModel();
      if (cached) {
        setActiveAvatarModel(cached);
      } else {
        AsyncStorage.getItem('speakmate_avatar_model').then((saved) => {
          if (saved) {
            setActiveAvatarModel(saved);
            setCachedAvatarModel(saved);
          } else {
            AsyncStorage.getItem('speakmate_ai_voice').then((v) => {
              const res = resolveAvatarFromVoice(v);
              setActiveAvatarModel(res.model);
            }).catch(() => {});
          }
        }).catch(() => {});
      }
    }, [])
  );

  const startScenario = (scenario) => {
    triggerStart(scenario?.title, scenario);
  };

  const triggerStart = (scenarioName, scenario) => {
    const defaultGreeting = getScenarioInitialGreeting(scenarioName);
    const durationNum = typeof scenario?.duration === 'number'
      ? scenario.duration
      : parseInt(String(scenario?.duration || '5').replace(/\D/g, ''), 10) || 5;
    const xpNum = typeof scenario?.xp === 'number'
      ? scenario.xp
      : parseInt(String(scenario?.xp || '10').replace(/\D/g, ''), 10) || 10;

    const effectiveDifficulty = scenario?.difficulty || (accountType === 'STUDENT' ? selectedGrade : 'Intermediate');
    const activeAvatar = getCachedAvatarModel() || activeAvatarModel || 'haru';

    // INSTANT NAVIGATION (0ms delay) - Opens ConversationScreen right away without any card loader!
    navigation.navigate('Conversation', {
      scenario: scenarioName,
      difficulty: effectiveDifficulty,
      estimatedDuration: durationNum,
      xpReward: xpNum,
      initialGreeting: defaultGreeting,
      ageGroup: userAgeGroup,
      standard: selectedGrade,
      accountType: accountType,
      avatarModel: activeAvatar,
    });
  };

  const handleDeleteHistory = (id) => {
    Alert.alert(
      'Delete Practice Record',
      'Are you sure you want to delete this speaking history item?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await speakingService.deleteHistory(id);
              setHistory((prev) => {
                const updated = prev.filter((h) => h.id !== id);
                cachedMobileSpeakingHistory = updated;
                AsyncStorage.setItem(SPEAKING_HISTORY_KEY, JSON.stringify(updated)).catch(() => {});
                return updated;
              });
              showToast('History Deleted', 'success', 'Speaking session removed.');
            } catch (err) {
              console.error('Delete speaking session error:', err);
              Alert.alert('Error', 'Could not delete speaking session. Please try again.');
            }
          },
        },
      ]
    );
  };

  // Active scenarios based on account type
  const isStudent = accountType === 'STUDENT';
  const activeScenarios = isStudent
    ? (STANDARD_SCENARIOS[selectedGrade] || STANDARD_SCENARIOS['1st Std'])
    : (AGE_SCENARIOS[userAgeGroup] || AGE_SCENARIOS['Professional']);

  // Filtered scenarios
  const filteredScenarios = activeScenarios.filter((s) => {
    const matchesSearch = s.title.toLowerCase().includes(searchText.toLowerCase()) ||
      s.desc.toLowerCase().includes(searchText.toLowerCase());
    const matchesCat = selectedCategory === 'All' || s.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: theme.bg }]}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(true); }} />}
    >
      {/* ── Header ── */}
      <LinearGradient colors={['#0F172A', '#1E1B4B']} style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Speaking Practice</Text>
          <Ionicons name="mic-circle" size={26} color={COLORS.primary} />
        </View>

        {/* Stats card */}
        <View style={styles.statsCard}>
          <View style={styles.statCell}>
            <Text style={styles.statVal}>{streak} 🔥</Text>
            <Text style={styles.statLbl}>Streak Days</Text>
          </View>
          <View style={styles.statCell}>
            <Text style={styles.statVal}>{Math.round(totalMinutes)}m</Text>
            <Text style={styles.statLbl}>Total Mins</Text>
          </View>
          <View style={styles.statCell}>
            <Text style={styles.statVal}>{totalXP} ⭐</Text>
            <Text style={styles.statLbl}>XP Earned</Text>
          </View>
          <View style={styles.statCell}>
            <Text style={styles.statVal}>{totalSessions}</Text>
            <Text style={styles.statLbl}>Sessions</Text>
          </View>
        </View>
      </LinearGradient>

      {/* ── Search Scenario ── */}
      <View style={styles.searchSection}>
        <View style={[styles.searchBar, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, borderWidth: isDark ? 1 : 0 }]}>
          <Ionicons name="search" size={18} color={theme.textSecondary} style={{ marginRight: 8 }} />
          <TextInput
            style={[styles.searchInput, { color: theme.textPrimary }]}
            placeholder="Search conversation scenarios..."
            placeholderTextColor={theme.textSecondary}
            value={searchText}
            onChangeText={setSearchText}
          />
          {searchText.length > 0 && (
            <TouchableOpacity onPress={() => setSearchText('')}>
              <Ionicons name="close" size={18} color={theme.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── School Grade Level Badge (For School Students Only) ── */}
      {isStudent && (
        <View style={{ paddingHorizontal: 16, marginVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name="school-outline" size={16} color="#818CF8" />
          <Text style={{ color: '#818CF8', fontSize: 13, fontWeight: '700' }}>
            School Grade Level: {selectedGrade}
          </Text>
        </View>
      )}

      {/* ── Categories Carousel ── */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll}>
        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat}
            onPress={() => {
              setSelectedCategory(cat);
              AsyncStorage.setItem('speakmate_speaking_category', cat).catch(() => {});
            }}
            style={[
              styles.catTab, 
              { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, borderWidth: isDark ? 1 : 0 }, 
              selectedCategory === cat && styles.catTabActive
            ]}
          >
            <Text style={[styles.catText, { color: theme.textSecondary }, selectedCategory === cat && styles.catTextActive]}>{cat}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ── Scenario Cards Grid ── */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.secTitle, { color: theme.textPrimary }]}>Conversation Scenarios</Text>
      </View>
      <View style={styles.grid}>
        {filteredScenarios.map((sc) => (
          <TouchableOpacity 
            key={sc.id} 
            style={[styles.scCard, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, borderWidth: isDark ? 1 : 0 }]} 
            onPress={() => startScenario(sc)}
          >
            <View style={styles.scHeader}>
              <View style={[styles.scIconBg, isDark && { backgroundColor: 'rgba(99,102,241,0.2)' }]}>
                <Ionicons name={sc.icon} size={22} color={COLORS.primary} />
              </View>
            </View>
            <Text style={[styles.scTitle, { color: theme.textPrimary }]} numberOfLines={1}>{sc.title}</Text>
            <Text style={[styles.scDesc, { color: theme.textSecondary }]} numberOfLines={2}>{sc.desc}</Text>
            <View style={[styles.scFooter, { borderTopColor: theme.cardBorder }]}>
              <Text style={[styles.scInfo, { color: theme.textSecondary }]}>{sc.duration} min · +{sc.xp} XP</Text>
              <Ionicons name="chevron-forward-circle" size={20} color={COLORS.primary} />
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Recent Conversations / History ── */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.secTitle, { color: theme.textPrimary }]}>Speaking History</Text>
      </View>
      <View style={styles.historyList}>
        {history.length === 0 ? (
          <View style={styles.emptyHistory}>
            <Ionicons name="document-text-outline" size={36} color={theme.textSecondary} />
            <Text style={[styles.emptyHistoryText, { color: theme.textSecondary }]}>No speaking history yet.</Text>
            <Text style={[styles.emptyHistorySub, { color: theme.textSecondary }]}>Start a scenario above to practice!</Text>
          </View>
        ) : (
          history.map((h) => (
            <View key={h.id} style={[styles.historyItem, { backgroundColor: theme.cardBg, borderColor: theme.cardBorder, borderWidth: isDark ? 1 : 0 }]}>
              <TouchableOpacity
                style={styles.historyClick}
                onPress={() => navigation.navigate('SpeakingHistoryDetail', { sessionId: h.id, item: h })}
              >
                <View style={styles.historyLeft}>
                  <View style={[styles.historyIconBg, isDark && { backgroundColor: 'rgba(124,58,237,0.2)' }]}>
                    <Ionicons name="chatbubble-ellipses-outline" size={20} color={COLORS.secondary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.historyTopic, { color: theme.textPrimary }]} numberOfLines={1}>{h.scenario}</Text>
                    <Text style={[styles.historyMeta, { color: theme.textSecondary }]}>
                      {new Date(h.createdAt).toLocaleDateString()} · {Math.round(h.duration / 60)}m · {h.score || 0}% score
                    </Text>
                    <Text style={[styles.historyPreview, { color: theme.textSecondary }]} numberOfLines={1}>
                      {h.previewMessage || 'No transcript saved.'}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDeleteHistory(h.id)} style={styles.deleteBtn}>
                <Ionicons name="trash-outline" size={18} color={COLORS.error} />
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAFC' },

  // Header & Stats
  header: { paddingBottom: 24, paddingHorizontal: 16, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 48, marginBottom: 20 },
  headerTitle: { color: '#FFF', fontSize: 18, fontWeight: '800' },
  statsCard: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 18, paddingVertical: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  statCell: { flex: 1, alignItems: 'center' },
  statVal: { color: '#FFF', fontSize: 15, fontWeight: '800' },
  statLbl: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '500', marginTop: 2 },

  // Search
  searchSection: { paddingHorizontal: 16, marginTop: 16 },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  searchInput: { flex: 1, color: COLORS.black, fontSize: 14 },

  // Categories
  catScroll: { paddingVertical: 12, paddingLeft: 16 },
  catTab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#FFF', marginRight: 8, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 8, elevation: 1 },
  catTabActive: { backgroundColor: COLORS.primary },
  catText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  catTextActive: { color: '#FFF' },

  // Scenario Cards Grid
  sectionHeader: { paddingHorizontal: 16, paddingVertical: 12 },
  secTitle: { fontSize: 16, fontWeight: '800', color: COLORS.black },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, gap: 10 },
  scCard: { width: '47%', backgroundColor: '#FFF', borderRadius: 18, padding: 14, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2, marginBottom: 4 },
  scHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  scIconBg: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center' },
  diffBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  diffBadgeText: { fontSize: 10, fontWeight: '700' },
  scTitle: { fontSize: 13, fontWeight: '800', color: COLORS.black, marginBottom: 2 },
  scDesc: { fontSize: 11, color: COLORS.text, lineHeight: 15, marginBottom: 10, height: 30 },
  scFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 8 },
  scInfo: { fontSize: 10, fontWeight: '600', color: '#64748B' },

  // History List
  historyList: { paddingHorizontal: 16 },
  emptyHistory: { alignItems: 'center', paddingVertical: 32 },
  emptyHistoryText: { fontSize: 14, fontWeight: '700', color: '#94A3B8', marginTop: 12 },
  emptyHistorySub: { fontSize: 12, color: '#CBD5E1', marginTop: 4 },
  historyItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', borderRadius: 16, padding: 12, marginBottom: 8, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 8, elevation: 1 },
  historyClick: { flex: 1 },
  historyLeft: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  historyIconBg: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#F5F3FF', alignItems: 'center', justifyContent: 'center' },
  historyTopic: { fontSize: 13, fontWeight: '700', color: COLORS.black },
  historyMeta: { fontSize: 11, color: '#64748B', marginVertical: 2 },
  historyPreview: { fontSize: 11, color: COLORS.text },
  deleteBtn: { padding: 8 },
});
