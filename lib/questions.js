/* The client discovery questionnaire, section by section. `col` is the
   column in Supabase (public.client_questionnaires) the answer is saved to. */

export const SECTIONS = [
  { title: "First, tell us about the business", questions: [
    { col: "q01_what_you_sell", q: "What exactly do you sell, and who usually buys it?" },
    { col: "q02_how_customers_found_you", q: "How did most of your current customers first find you?" },
    { col: "q03_customers_you_want_more_of", q: "What type of customer do you want more of?" },
    { col: "q04_top_product_now", q: "Which product or service brings you the most business right now?" },
    { col: "q05_product_to_sell_more", q: "Which product or service do you want to sell more of?" },
  ] },
  { title: "Understand your customer", questions: [
    { col: "q06_first_questions_asked", q: "When a customer first contacts you, what do they usually ask?" },
    { col: "q07_biggest_doubt", q: "What is the biggest doubt customers have before buying?" },
    { col: "q08_why_think_about_it", q: "What is the most common reason someone says, “I’ll think about it”?" },
    { col: "q09_what_convinces_them", q: "What usually convinces them to finally buy?" },
    { col: "q10_what_happy_customers_like", q: "What do your happiest customers usually appreciate about you?" },
    { col: "q11_common_complaints", q: "What complaints or negative feedback do you hear most often?" },
  ] },
  { title: "Get the real business story", questions: [
    { col: "q12_better_than_competitors", q: "What do you think your business does better than your competitors?" },
    { col: "q13_what_praise_mentions", q: "What do customers specifically mention when they praise you?" },
    { col: "q14_wish_people_knew", q: "What is something you wish more people knew about your business?" },
    { col: "q15_wrong_assumptions", q: "What is something people assume about your business that is completely wrong?" },
    { col: "q16_proud_project_story", q: "Tell us about one customer or project you’re really proud of. What happened?" },
  ] },
  { title: "Competitors", questions: [
    { col: "q17_compared_with", q: "Who do customers compare you with before choosing you?" },
    { col: "q18_why_they_choose_competitors", q: "Why do you think customers choose them instead of you?" },
    { col: "q19_better_than_them", q: "What do you think you do better than them?" },
    { col: "q20_competitors_do_better", q: "Is there anything your competitors are doing that you wish you were doing better?" },
  ] },
  { title: "Content", questions: [
    { col: "q21_daily_questions", q: "What questions do you answer almost every day?" },
    { col: "q22_industry_misconceptions", q: "What do customers usually get wrong about your industry?" },
    { col: "q23_explain_again_and_again", q: "What do you explain to customers again and again before they buy?" },
    { col: "q24_behind_the_scenes", q: "What happens behind the scenes in your business that customers never get to see?" },
    { col: "q25_stories_and_results", q: "Do you have any customer stories, before and after results, interesting projects, mistakes, achievements or funny incidents we can show?" },
    { col: "q26_do_not_show", q: "Are there things you do not want us to show or talk about publicly?" },
  ] },
  { title: "Brand personality", questions: [
    { col: "q27_how_content_should_feel", q: "When someone sees your content, how do you want them to feel?" },
    { col: "q28_three_words_best", q: "Which 3 words describe your business best?" },
    { col: "q29_three_words_never", q: "Which 3 words should never describe your brand?" },
    { col: "q30_accounts_you_like", q: "Share 2 or 3 Instagram accounts or brands whose content you genuinely like. What do you like about them?" },
    { col: "q31_accounts_you_dislike", q: "Share 1 or 2 accounts you do not like. What don’t you like about them?" },
  ] },
  { title: "Business goals", questions: [
    { col: "q32_biggest_marketing_problem", q: "Right now, what is the biggest problem you want marketing to solve?" },
    { col: "q33_valuable_enquiries", q: "If we gave you 100 enquiries next month, what type of enquiries would actually be valuable to you?" },
    { col: "q34_success_after_3_months", q: "What would make you say after 3 months, “Yes, this content strategy is working”?" },
    { col: "q35_next_3_to_6_months", q: "What are you launching, changing, promoting or planning in the next 3 to 6 months?" },
  ] },
  { title: "The important ones", questions: [
    { col: "q36_understand_your_customers", q: "If we could spend one day with your customers, what would you want us to understand about them?" },
    { col: "q37_one_thing_to_tell_customers", q: "If you could tell your potential customers one thing before they choose you, what would it be?" },
    { col: "q38_what_we_might_misunderstand", q: "What is the one thing about your business that you think we might completely misunderstand if we only looked at your Instagram or website?" },
    { col: "q39_what_we_should_ask", q: "What should we ask you that we haven’t asked yet?" },
  ] },
];


/* Copied from the website repo (app/client-discovery-k7q2x9/questions.js)
   so the Studio can show each answer under its question. */
