import { mutation, action, internalMutation, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import OpenAI from "openai";
import { getResourceEndpoint } from "./utils/azure";

const rootEndpoint = getResourceEndpoint(process.env.AZURE_OPENAI_ENDPOINT || "");
const chatDeployment = process.env.AZURE_OPENAI_DEPLOYMENT_NAME || "gpt-4.1";
const chatEndpoint = `${rootEndpoint}/openai/deployments/${chatDeployment}`;

// Configure OpenAI client for chat completions
const openai = new OpenAI({
  apiKey: process.env.AZURE_OPENAI_API_KEY || "dummy-key",
  baseURL: chatEndpoint,
  defaultQuery: { "api-version": process.env.OPENAI_API_VERSION || "2025-01-01-preview" },
  defaultHeaders: {
    "api-key": process.env.AZURE_OPENAI_API_KEY || "dummy-key",
  },
});

// Configure separate OpenAI client for embeddings with correct endpoint
const embeddingModel = process.env.AZURE_EMBEDDING_DEPLOYMENT_NAME || 'text-embedding-3-large';
const embeddingEndpoint = `${rootEndpoint}/openai/deployments/${embeddingModel}`;

const embeddingClient = new OpenAI({
  apiKey: process.env.AZURE_OPENAI_API_KEY || 'dummy-key',
  baseURL: embeddingEndpoint,
  defaultQuery: { 'api-version': process.env.OPENAI_API_VERSION || '2024-02-01' },
  defaultHeaders: {
    'api-key': process.env.AZURE_OPENAI_API_KEY || 'dummy-key',
  },
});

// Seed Plaksha University curriculum data with embeddings
export const seedPlakshaCurriculum = mutation({
  args: {},
  handler: async (ctx) => {
    // Check if data already exists
    const existing = await ctx.db.query("plakshaCourses").first();
    if (existing) {
      return "Curriculum data already exists";
    }

    const plakshaCourses = [
      // SEMESTER 1 - Freshmore Courses
      {
        code: "CT101",
        title: "Computational Thinking",
        description: "This course is the introductory course on computational thinking. It introduces elements of programming and paradigms from basic to advanced (like divide and conquer), showing how these can be used to build programs for solving problems. Students are exposed to computational problems to appreciate the significance of programming. The course also connects mathematical problems to computation, nurturing a problem-solving mindset. Programming is taught using languages like C.",
        credits: 4,
        isCoreRequirement: true,
        department: "Computer Science",
        semester: 1,
      },
      {
        code: "MA101",
        title: "Engineering Math in Action",
        description: "This course covers linear algebra and ordinary differential equations through theory and applications. Students will also use computers to solve relevant mathematical problems. The course is divided into four modules, each with conceptual cores split into weekly tiers. Each week includes two 45-minute lectures and a 90-minute lab. Students complete four mini-projects throughout the semester.",
        credits: 4,
        isCoreRequirement: true,
        department: "Mathematics",
        semester: 1,
      },
      {
        code: "CS102",
        title: "Coding Café",
        description: "This hands-on course helps students understand development environments, testing, debugging, and troubleshooting. It also introduces tools like vi, git, and GitHub. Scripting languages like Bash and Python are used for writing automation scripts, helping students boost productivity and understand program behavior more deeply.",
        credits: 2,
        isCoreRequirement: true,
        department: "Computer Science",
        semester: 1,
      },
      {
        code: "BIO101",
        title: "Engines of Life",
        description: "A course that addresses how to respond to today's grand challenges by drawing inspiration from biological organisms evolved over 3.8 billion years. It focuses on nature's elegant, efficient designs and encourages students to explore innovations inspired by biology to create sustainable solutions for the future.",
        credits: 3,
        isCoreRequirement: true,
        department: "Biology",
        semester: 1,
      },
      {
        code: "COM101",
        title: "The Art of Thinking, Reasoning, and Communication",
        description: "This course trains students in critical and scientific thinking. It encourages examination of assumptions, rigorous enquiry, and reflection. Students develop habits of questioning, reasoning with evidence, and scientific thinking to respond effectively to modern challenges.",
        credits: 3,
        isCoreRequirement: true,
        department: "Communication",
        semester: 1,
      },
      {
        code: "IL101",
        title: "Innovation Lab & Grand Challenge: Design and Innovation",
        description: "This course immerses students in community-based challenges, connecting with the UN Sustainable Development Goals. Through field visits, tutorials, and teamwork, students observe, analyze, and empathize with real-world problems. It builds the foundation for deeper exploration in later semesters. Focused on human-centric design and problem-solving, this course introduces the design thinking process.",
        credits: 3,
        isCoreRequirement: true,
        department: "Innovation",
        semester: 1,
      },

      // SEMESTER 2 - Freshmore Courses
      {
        code: "CS201",
        title: "Programming and Data Structures",
        description: "An in-depth course on Object-Oriented Programming (OOP) and fundamental data structures. Topics include OOP principles, classes, inheritance, exception handling, stacks, queues, lists, trees, graphs, and sorting algorithms. Builds on the Computational Thinking course with practical problem-solving.",
        credits: 4,
        isCoreRequirement: true,
        department: "Computer Science",
        semester: 2,
      },
      {
        code: "PH201",
        title: "Foundations of Physical World",
        description: "This physics course introduces classical mechanics, thermodynamics, quantum mechanics, and modern physics. Using demonstrations, labs, and projects, students gain theoretical and practical understanding of physics concepts with real-world relevance.",
        credits: 4,
        isCoreRequirement: true,
        department: "Physics",
        semester: 2,
      },
      {
        code: "MA201",
        title: "Mathematics of Uncertainty",
        description: "Covers probability and statistics, with emphasis on both theory and application. Students learn modeling, analysis, and data interpretation using computational tools. The course has five modules divided into tiers, each including lectures and lab work.",
        credits: 3,
        isCoreRequirement: true,
        department: "Mathematics",
        semester: 2,
      },
      {
        code: "BIO201",
        title: "Nature's Machines",
        description: "Explores biological machines from organ systems to cells. Covers Human Physiology, Biology, Immunology, and Biomimicry. Students learn how nature's mechanisms inspire engineering solutions and understand biological systems at micro and macro levels.",
        credits: 3,
        isCoreRequirement: true,
        department: "Biology",
        semester: 2,
      },
      {
        code: "EC201",
        title: "Fundamentals of Microeconomics",
        description: "Students learn microeconomic concepts like consumer theory, supply and demand, market structures, efficiency, and government policy. It includes applications of game theory, risk, and uncertainty. A brief macroeconomics component introduces inflation, unemployment, and productivity.",
        credits: 3,
        isCoreRequirement: true,
        department: "Economics",
        semester: 2,
      },
      {
        code: "SOC201",
        title: "Reimagining Technology and Society",
        description: "A philosophical and interdisciplinary exploration of technology and its relationship with society. The course covers historical and cultural perspectives, challenges dominant assumptions, and helps students imagine alternative futures where technology is shaped by societal values.",
        credits: 3,
        isCoreRequirement: true,
        department: "Social Sciences",
        semester: 2,
      },
      {
        code: "COM201",
        title: "Communication Lab - II",
        description: "Advanced communication skills development focusing on technical writing, presentation skills, and professional communication in engineering and technology contexts.",
        credits: 2,
        isCoreRequirement: true,
        department: "Communication",
        semester: 2,
      },
      {
        code: "IL201",
        title: "Innovation Lab & Grand Challenge - II",
        description: "Continuation of innovation lab work with deeper engagement in community challenges and design thinking methodologies.",
        credits: 3,
        isCoreRequirement: true,
        department: "Innovation",
        semester: 2,
      },
      {
        code: "PE201",
        title: "Yoga/Sports",
        description: "Physical education course focusing on yoga, sports, and overall wellness for holistic development.",
        credits: 1,
        isCoreRequirement: true,
        department: "Physical Education",
        semester: 2,
      },

      // SEMESTER 3 - Freshmore Courses
      {
        code: "EE301",
        title: "Electronic System Engineering",
        description: "Covers fundamentals of electronics and their applications in modern devices. From circuit theory to semiconductors, the course teaches how components combine to form systems. Emphasis is on both design and prototyping of functional electronic artifacts.",
        credits: 4,
        isCoreRequirement: true,
        department: "Electrical Engineering",
        semester: 3,
      },
      {
        code: "CS301",
        title: "Intelligent Machines",
        description: "An introduction to robotics and cyber-physical systems. Includes sensors, actuators, system modeling, kinematics, control systems, perception, IoT, and hardware integration. Through labs and projects, students learn to design and build intelligent systems.",
        credits: 4,
        isCoreRequirement: true,
        department: "Computer Science",
        semester: 3,
      },
      {
        code: "MA301",
        title: "Computational Methods and Optimization",
        description: "Introduces applied math topics including ODEs, numerical methods, PDEs, optimization, and calculus of variations. Students explore methods for modeling, approximating, and optimizing complex systems, building a strong foundation for scientific computing and analysis.",
        credits: 3,
        isCoreRequirement: true,
        department: "Mathematics",
        semester: 3,
      },
      {
        code: "SOC301",
        title: "Entangled World: Technology and Anthropocene",
        description: "Explores the interconnectedness of human and non-human systems through perspectives from art, science, philosophy, and technology. It challenges the isolated view of human actions and emphasizes entanglement as a lens for understanding global challenges.",
        credits: 3,
        isCoreRequirement: true,
        department: "Social Sciences",
        semester: 3,
      },
      {
        code: "DS301",
        title: "Introduction to Data Science",
        description: "Combines statistics, computing, and visualization to derive insights from data. Students learn data collection, exploration, hypothesis testing, and modeling techniques. Emphasis is on developing intuition and applying tools to real-world problems.",
        credits: 3,
        isCoreRequirement: true,
        department: "Data Science",
        semester: 3,
      },
      {
        code: "COM301",
        title: "Communication Lab - III",
        description: "Advanced technical communication with focus on research writing, documentation, and cross-cultural communication in technology contexts.",
        credits: 2,
        isCoreRequirement: true,
        department: "Communication",
        semester: 3,
      },
      {
        code: "UHV301",
        title: "UHV-II",
        description: "Universal Human Values course focusing on ethical development, moral reasoning, and value-based decision making.",
        credits: 2,
        isCoreRequirement: true,
        department: "Philosophy",
        semester: 3,
      },
      {
        code: "IL301",
        title: "Innovation Lab & Grand Challenge - III",
        description: "Advanced innovation lab work with focus on prototype development and testing of solutions to real-world challenges.",
        credits: 3,
        isCoreRequirement: true,
        department: "Innovation",
        semester: 3,
      },
      {
        code: "CS302",
        title: "The Philosophy and Foundations of Computing and AI",
        description: "Investigates foundational questions in computing and AI: What is a computer? Can it think or be conscious? Covers the work of Alan Turing, limits of computability, and early AI development. Philosophical discussions complement historical insights.",
        credits: 3,
        isCoreRequirement: true,
        department: "Computer Science",
        semester: 3,
      },

      // SEMESTER 4 - Core Courses
      {
        code: "CS401",
        title: "Introduction to Data Mining",
        description: "Introduction to Data Mining bridges the domains of databases, statistics, and machine learning. The course covers SQL databases, including querying, relating, designing, writing, viewing, optimizing, and scaling. It explores NoSQL databases, relational algebra, data visualization, descriptive statistics, regression analysis, text data handling, network data analysis, and scaling techniques for massive datasets.",
        credits: 4,
        isCoreRequirement: true,
        department: "Computer Science",
        semester: 4,
      },
      {
        code: "CS402",
        title: "Machine Learning and Pattern Recognition",
        description: "Dive into the dynamic world of Machine Learning and Pattern Recognition. Here, you will explore essential principles, analysis techniques, and algorithms crucial for recognizing patterns in a variety of real-world data types, including audio, visual, text, and financial information. This course highlights the transformative impact of AI across multiple domains, with practical applications demonstrated through online search, voice recognition, facial identification, and medical diagnosis.",
        credits: 4,
        isCoreRequirement: true,
        department: "Computer Science",
        semester: 4,
      },
      {
        code: "CS403",
        title: "Connected Systems and IoT",
        description: "Considering the layered network structure of modern networks, this course follows the top-down approach for presenting network applications, architecture and protocols. We start from a simple overview of general network structure to give a contextual description of the material to follow in the course, starting from the Application Layer and then going down to the Transport Layer, Network Layer, the Wired and Wireless Link Layers and ending with some of the important aspects of data and network security.",
        credits: 3,
        isCoreRequirement: true,
        department: "Computer Science",
        semester: 4,
      },
      {
        code: "CS404",
        title: "Design and Analysis of Algorithms",
        description: "This course covers the design and analysis of fundamental algorithms used in practice. It focuses on three major aspects of algorithms. The first aspect is how to measure the time/space complexity of existing algorithms for basic problems. The second aspect is understanding well-known paradigms for designing algorithms, including induction, divide-and-conquer, dynamic programming, and greedy approaches. The third aspect covers designing efficient algorithms for several fundamental problems in computer science.",
        credits: 4,
        isCoreRequirement: true,
        department: "Computer Science",
        semester: 4,
      },
      {
        code: "COM401",
        title: "Communication Lab-IV",
        description: "Capstone communication course focusing on professional presentation skills, technical documentation, and industry-standard communication practices.",
        credits: 2,
        isCoreRequirement: true,
        department: "Communication",
        semester: 4,
      },
      {
        code: "IL401",
        title: "Innovation Lab & Grand Challenge-IV",
        description: "Final innovation lab course where students complete and present comprehensive solutions to grand challenges, integrating all previous learning.",
        credits: 3,
        isCoreRequirement: true,
        department: "Innovation",
        semester: 4,
      },
      {
        code: "NEU401",
        title: "Neuroscience",
        description: "Introduction to neuroscience covering brain structure, neural networks, cognitive processes, and the intersection of neuroscience with artificial intelligence and computing.",
        credits: 3,
        isCoreRequirement: false,
        department: "Neuroscience",
        semester: 4,
      },

      // ELECTIVES AND ADVANCED COURSES (Semesters 5+)
      {
        code: "MA501",
        title: "Calculus in Higher Dimensions",
        description: "Introduces complex analysis, Fourier series, and vector calculus, focusing on their applications in science and engineering. Builds advanced mathematical tools useful in a range of technical disciplines.",
        credits: 3,
        isCoreRequirement: false,
        department: "Mathematics",
        semester: 5,
      },
      {
        code: "PHI501",
        title: "Ethics of Technological Innovation",
        description: "Addresses the ethical implications of rapid technological advancement. Focuses on interconnectedness, unintended consequences, and the mismatch between technological capabilities and ethical frameworks in the Anthropocene. Encourages critical reflection on how we design and use technology.",
        credits: 3,
        isCoreRequirement: false,
        department: "Philosophy",
        semester: 5,
      },
      {
        code: "CS501",
        title: "Knowledge Representation and Reasoning",
        description: "Intelligence requires the ability to search for solutions, represent and reason about the world the agent operates in, use memory to remember past experiences, along with language and perception. In this course, Knowledge Representation and Reasoning, we look at the second activity. Beginning with classical logic for representation and reasoning, we look at efficient subsets of Horn clause and Description logic.",
        credits: 3,
        isCoreRequirement: false,
        department: "Computer Science",
        semester: 5,
      },
      {
        code: "CS502",
        title: "Reinforcement Learning Fundamentals",
        description: "This course introduces the fundamental concepts and techniques of reinforcement learning (RL). Students will learn the basics of RL, explore key algorithms, gain practical experience through coding assignments, and discover real-world applications. Topics include Multi-armed Bandits, Markov Decision Processes, Q-Learning, Policy Gradient methods, Deep Reinforcement Learning, Multiagent RL, and Inverse RL.",
        credits: 4,
        isCoreRequirement: false,
        department: "Computer Science",
        semester: 6,
      },
      {
        code: "CS503",
        title: "Cryptography and Blockchain",
        description: "This course focuses on introducing the basics of cryptography and blockchain. The following topics will be covered: some mathematical background for cryptography, classical ciphers, security notions, stream ciphers, block ciphers, hash functions, public-key and private-key cryptography, digital signatures, encryption, and some cryptographic protocols used in practice. Additionally, it will cover blockchain, mainly focusing on Bitcoin.",
        credits: 3,
        isCoreRequirement: false,
        department: "Computer Science",
        semester: 5,
      },
      {
        code: "CS504",
        title: "Machine Learning in Dynamic Environments",
        description: "Have you considered how Netflix recommends movies to you? Or how you are recommended items to buy on Amazon? Recommender systems are systems that recommend restaurants, movies, or content to watch, etc., by learning a user's preferences. This course will introduce the algorithmic techniques through various practically relevant problems such as classification, portfolio management, recommender systems, etc.",
        credits: 3,
        isCoreRequirement: false,
        department: "Computer Science",
        semester: 6,
      },
      {
        code: "CS505",
        title: "Networks",
        description: "Considering the layered network structure of modern networks, this course follows the top-down approach for presenting network applications, architecture and protocols. We start from a simple overview of general network structure to give a contextual description of the material to follow in the course, starting from the Application Layer and then going down to the Transport Layer, Network Layer, the Wired and Wireless Link Layers.",
        credits: 3,
        isCoreRequirement: false,
        department: "Computer Science",
        semester: 5,
      },
      {
        code: "HCI501",
        title: "Human-Tech Interaction",
        description: "Immerse yourself in the fascinating study of Human-Tech Interaction, a course designed to delve into the complex interactions between humans and technology through a multi-modal sensory approach. This approach harnesses technologies such as biosensors, computer vision, and electro-mechanical sensors to monitor and model human physiological and behavioural responses.",
        credits: 3,
        isCoreRequirement: false,
        department: "Human-Computer Interaction",
        semester: 7,
      },
      {
        code: "CS506",
        title: "Programming Language Principles & Design",
        description: "This course introduces the basic concepts that serve as a basis for understanding the design space of programming languages in terms of their constructs, paradigms, evaluation criteria and language implementation issues. It introduces concepts from imperative, object oriented, functional, logic-based, constraint-based and concurrent programming.",
        credits: 3,
        isCoreRequirement: false,
        department: "Computer Science",
        semester: 6,
      },
      {
        code: "CS507",
        title: "Deep Learning",
        description: "Deep learning has made impressive advances in various domains. The backbone of these advances has been the learning of representations enabled through big data. In this course, one would get a conceptual and practical introduction to the elements of deep learning. Module 1 will discuss the building blocks: different types of neural networks (conv, recurrent, graph), and how to learn effective embeddings through state-of-the-art architectures like attention modules, transformers, memory networks, GPT, etc.",
        credits: 4,
        isCoreRequirement: false,
        department: "Computer Science",
        semester: 5,
      },
      {
        code: "CS508",
        title: "Foundations of Computer Systems",
        description: "Systems Programming provides a programmer's view of how computer systems execute programs, store information, and communicate. It enables students to become more effective programmers, especially in dealing with issues of performance, portability and robustness. Topics include C, C++, and assembly language programming, performance analysis and improvement strategies, memory management, caching, concurrency, threads, and synchronization.",
        credits: 4,
        isCoreRequirement: false,
        department: "Computer Science",
        semester: 5,
      },
      {
        code: "CS509",
        title: "Theory of Computation",
        description: "Occasionally, several computational problems arise in computer science and mathematics. The very first question is whether all computational problems are solvable by existing computers, and which problems can be solved efficiently. This course addresses these questions. The theory of computation encompasses two main areas: automata theory and computability theory.",
        credits: 3,
        isCoreRequirement: false,
        department: "Computer Science",
        semester: 6,
      },
      {
        code: "CS510",
        title: "Search Methods in AI",
        description: "Intelligence requires the ability to search for solutions, represent and reason about the world the agent operates in, use memory to remember past experiences, along with language and perception. In this course, Search Methods in AI, we take up the first of the three activities. Confronted with a new problem the only recourse is to search for a solution.",
        credits: 3,
        isCoreRequirement: false,
        department: "Computer Science",
        semester: 7,
      },
    ];

    // Insert all courses without embeddings first
    for (const course of plakshaCourses) {
      await ctx.db.insert("plakshaCourses", course);
    }

    // Schedule embedding generation
    await ctx.scheduler.runAfter(0, internal.seedData.generateEmbeddings, {});

    return `Successfully seeded ${plakshaCourses.length} courses. Generating embeddings...`;
  },
});

// Generate embeddings for all courses
export const generateEmbeddings = internalAction({
  args: {},
  handler: async (ctx) => {
    const courses = await ctx.runQuery(api.courses.getPlakshaCourses);
    
    for (const course of courses) {
      if (!course.embedding) {
        try {
          const embedding = await generateEmbedding(course.description);
          if (!embedding || embedding.length === 0) {
            console.warn(`[SeedData] Skipping update for course due to empty embedding: ${course.code}`);
            continue;
          }
          await ctx.runMutation(internal.seedData.updateCourseEmbedding, {
            courseId: course._id,
            embedding,
          });
        } catch (error) {
          console.error(`Failed to generate embedding for ${course.code}:`, error);
        }
      }
    }
    
    return "Embeddings generated successfully";
  },
});

// Update course with embedding
export const updateCourseEmbedding = internalMutation({
  args: {
    courseId: v.id("plakshaCourses"),
    embedding: v.array(v.number()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.courseId, {
      embedding: args.embedding,
    });
  },
});

// Generate embedding for text
async function generateEmbedding(text: string): Promise<number[]> {
  console.log("[Embedding] Input:", JSON.stringify(text));
  console.log("[Embedding] Input type:", typeof text);
  console.log("[Embedding] Input length:", text?.length);
  
  if (typeof text !== "string" || !text.trim()) {
    console.error("[Embedding] Invalid input for embedding:", text);
    throw new Error("Embedding input must be a non-empty string.");
  }
  
  // For Azure OpenAI, the model name in the request should match the deployment name
  console.log("[Embedding] Using model:", embeddingModel);
  console.log("[Embedding] Using endpoint:", embeddingEndpoint);
  
  try {
    const requestPayload = {
      model: embeddingModel,
      input: text,
    };
    console.log("[Embedding] Request payload:", JSON.stringify(requestPayload));
    
    const response = await embeddingClient.embeddings.create(requestPayload);
    
    if (!response.data || !response.data[0] || !response.data[0].embedding) {
      throw new Error("Invalid response from OpenAI embeddings API");
    }
    
    return response.data[0].embedding;
  } catch (error) {
    console.error("[Embedding] Error from OpenAI API:", error);
    console.error("[Embedding] Error details:", {
      message: error instanceof Error ? error.message : 'Unknown error',
      status: (error as any)?.status,
      code: (error as any)?.code,
      type: (error as any)?.type,
      param: (error as any)?.param,
    });
    throw error;
  }
}
