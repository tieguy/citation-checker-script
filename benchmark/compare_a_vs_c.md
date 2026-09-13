# Compare Results — 2026-05-15T15:22:56.391Z

Change axes: `prompt`, `pipeline`
Control run at: 2026-05-15T05:20:51.857Z
Treatment run at: 2026-05-15T15:19:20.081Z

Compared cells: **1571** of 1598 intersection (15 control-only, 8 treatment-only excluded). Dataset: 178 valid of 189.
Noise floor: ±5pp (single-provider 95% CI heuristic).

## Headline accuracy

| Provider | n | Control exact | Treatment exact | Δ exact | Control lenient | Treatment lenient | Δ lenient | Control binary | Treatment binary | Δ binary |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| openrouter-mistral-small-3.2 | 178 | 47.8% | 59.0% | +11.2 | 71.9% | 81.5% | +9.6 | 79.2% | 81.5% | +2.2 |
| gemini-2.5-flash (noise) | 177 | 68.4% | 68.4% | +0.0 | 81.9% | 80.8% | -1.1 | 83.6% | 80.8% | -2.8 |
| hf-gpt-oss-20b (noise) | 148 | 66.9% | 66.2% | -0.7 | 81.1% | 79.7% | -1.4 | 81.1% | 79.7% | -1.4 |
| hf-qwen3-32b | 178 | 64.0% | 73.6% | +9.6 | 80.9% | 83.1% | +2.2 | 84.8% | 83.1% | -1.7 |
| openrouter-gemma-4-26b-a4b | 178 | 62.4% | 68.0% | +5.6 | 80.3% | 83.1% | +2.8 | 82.0% | 83.1% | +1.1 |
| hf-deepseek-v3 | 178 | 66.9% | 77.0% | +10.1 | 80.9% | 87.1% | +6.2 | 86.0% | 87.1% | +1.1 |
| claude-sonnet-4-5 (noise) | 178 | 59.6% | 59.0% | -0.6 | 79.2% | 80.3% | +1.1 | 80.9% | 80.3% | -0.6 |
| openrouter-granite-4.1-8b | 178 | 66.9% | 60.1% | -6.7 | 79.2% | 73.0% | -6.2 | 80.3% | 78.1% | -2.2 |
| openrouter-qwen-3-32b | 178 | 61.2% | 66.3% | +5.1 | 77.5% | 82.0% | +4.5 | 80.3% | 82.0% | +1.7 |

## Flips

| Provider | Entry ID | Claim | Control | Treatment | Ground truth | Direction |
|---|---|---|---|---|---|---|
| openrouter-mistral-small-3.2 | row_3 | While the United States represented about 4% of the total gl… | Partially supported | Supported | Partially supported | regression |
| hf-qwen3-32b | row_8 | persons admitted under the Nicaraguan and Central American R… | Not supported | Supported | Supported | improvement |
| hf-gpt-oss-20b | row_8 | persons admitted under the Nicaraguan and Central American R… | Partially supported | Not supported | Supported | lateral |
| hf-deepseek-v3 | row_7 | and 1.0% who were granted the Special Immigrant Visa (SIV) f… | Source unavailable | Not supported | Supported | lateral |
| hf-deepseek-v3 | row_8 | persons admitted under the Nicaraguan and Central American R… | Source unavailable | Not supported | Supported | lateral |
| hf-gpt-oss-20b | row_10 | Census estimates show 45.3 million foreign born residents in… | Not supported | Partially supported | Partially supported | improvement |
| hf-qwen3-32b | row_11 | In 2017, out of the U.S. foreign-born population, some 45% (… | Partially supported | PARSE_ERROR | Partially supported | regression |
| gemini-2.5-flash | row_22 | The Emergency Quota Act was enacted in 1921, limiting immigr… | Source unavailable | Not supported | Partially supported | lateral |
| openrouter-mistral-small-3.2 | row_7 | and 1.0% who were granted the Special Immigrant Visa (SIV) f… | Source unavailable | Partially supported | Supported | lateral |
| hf-qwen3-32b | row_13 | Causes of migration include poverty, crime | Supported | PARSE_ERROR | Supported | regression |
| claude-sonnet-4-5 | row_14 | Causes of migration include poverty, crime | Supported | Partially supported | Supported | regression |
| gemini-2.5-flash | row_20 | After an initial wave of immigration from China following th… | Not supported | Partially supported | Not supported | regression |
| gemini-2.5-flash | row_19 | By comparison, in the first federal census, in 1790, the pop… | Source unavailable | Not supported | Supported | lateral |
| hf-qwen3-32b | row_15 | During the 17th century, approximately 400,000 English peopl… | Supported | PARSE_ERROR | Supported | regression |
| openrouter-mistral-small-3.2 | row_8 | persons admitted under the Nicaraguan and Central American R… | Source unavailable | Not supported | Supported | lateral |
| hf-gpt-oss-20b | row_16 | Over half of all European immigrants to Colonial America dur… | Not supported | Partially supported | Supported | lateral |
| claude-sonnet-4-5 | row_15 | During the 17th century, approximately 400,000 English peopl… | Not supported | Partially supported | Supported | lateral |
| hf-deepseek-v3 | row_14 | Causes of migration include poverty, crime | Partially supported | Supported | Supported | improvement |
| hf-deepseek-v3 | row_16 | Over half of all European immigrants to Colonial America dur… | Supported | Partially supported | Supported | regression |
| openrouter-gemma-4-26b-a4b | row_8 | persons admitted under the Nicaraguan and Central American R… | Source unavailable | Not supported | Supported | lateral |
| hf-deepseek-v3 | row_15 | During the 17th century, approximately 400,000 English peopl… | Partially supported | Supported | Supported | improvement |
| hf-qwen3-32b | row_19 | By comparison, in the first federal census, in 1790, the pop… | Source unavailable | Not supported | Supported | lateral |
| claude-sonnet-4-5 | row_19 | By comparison, in the first federal census, in 1790, the pop… | Source unavailable | Not supported | Supported | lateral |
| hf-qwen3-32b | row_20 | After an initial wave of immigration from China following th… | Source unavailable | Not supported | Not supported | improvement |
| claude-sonnet-4-5 | row_22 | The Emergency Quota Act was enacted in 1921, limiting immigr… | Source unavailable | Not supported | Partially supported | lateral |
| hf-deepseek-v3 | row_20 | After an initial wave of immigration from China following th… | Source unavailable | Not supported | Not supported | improvement |
| hf-gpt-oss-20b | row_22 | The Emergency Quota Act was enacted in 1921, limiting immigr… | Source unavailable | Not supported | Partially supported | lateral |
| gemini-2.5-flash | row_31 | After Aden's fall to the PLC, Zoubaidi went missing for a br… | Partially supported | Not supported | Supported | lateral |
| hf-qwen3-32b | row_22 | The Emergency Quota Act was enacted in 1921, limiting immigr… | Source unavailable | Not supported | Partially supported | lateral |
| hf-deepseek-v3 | row_19 | By comparison, in the first federal census, in 1790, the pop… | Source unavailable | Supported | Supported | improvement |
| hf-deepseek-v3 | row_22 | The Emergency Quota Act was enacted in 1921, limiting immigr… | Source unavailable | Not supported | Partially supported | lateral |
| gemini-2.5-flash | row_29 | On 7 January 2026, Saudi Arabia launched airstrikes against … | Not supported | Partially supported | Partially supported | improvement |
| openrouter-qwen-3-32b | row_9 | of these ethnic quotas with per-country limits for family-sp… | Supported | Partially supported | Supported | regression |
| openrouter-qwen-3-32b | row_8 | persons admitted under the Nicaraguan and Central American R… | Not supported | Partially supported | Supported | lateral |
| hf-qwen3-32b | row_25 | Following Aden's capture, the secretary-general of the STC a… | Partially supported | Supported | Supported | improvement |
| claude-sonnet-4-5 | row_28 | On 7 January, the Saudi-backed forces began advancing toward… | Supported | Partially supported | Supported | regression |
| hf-qwen3-32b | row_27 | A few weeks later, the Battle of Aden broke out between the … | Partially supported | Not supported | Supported | lateral |
| gemini-2.5-flash | row_40 | That evening, Benomar announced an agreement that would end … | Partially supported | Not supported | Supported | lateral |
| gemini-2.5-flash | row_39 | More than 60 were killed in clashes on 19 September. | Partially supported | Not supported | Supported | lateral |
| openrouter-granite-4.1-8b | row_11 | In 2017, out of the U.S. foreign-born population, some 45% (… | Partially supported | PARSE_ERROR | Partially supported | regression |
| openrouter-qwen-3-32b | row_11 | In 2017, out of the U.S. foreign-born population, some 45% (… | Supported | Not supported | Partially supported | lateral |
| claude-sonnet-4-5 | row_31 | After Aden's fall to the PLC, Zoubaidi went missing for a br… | Partially supported | Not supported | Supported | lateral |
| openrouter-qwen-3-32b | row_7 | and 1.0% who were granted the Special Immigrant Visa (SIV) f… | Partially supported | Not supported | Supported | lateral |
| claude-sonnet-4-5 | row_33 | The Yemeni government charged Zoubaidi with high treason on … | Partially supported | Supported | Supported | improvement |
| hf-qwen3-32b | row_32 | The STC maintains that Zoubaidi remains in Aden. | Partially supported | Supported | Supported | improvement |
| claude-sonnet-4-5 | row_39 | More than 60 were killed in clashes on 19 September. | Not supported | Supported | Supported | improvement |
| openrouter-mistral-small-3.2 | row_15 | During the 17th century, approximately 400,000 English peopl… | Partially supported | Not supported | Supported | lateral |
| claude-sonnet-4-5 | row_44 | The rebels signed a deal with the government, prompting Prim… | Supported | Partially supported | Supported | regression |
| hf-qwen3-32b | row_39 | More than 60 were killed in clashes on 19 September. | Not supported | Partially supported | Supported | lateral |
| openrouter-mistral-small-3.2 | row_19 | By comparison, in the first federal census, in 1790, the pop… | Source unavailable | Supported | Supported | improvement |
| claude-sonnet-4-5 | row_47 | Saleh's party, the General People's Congress, joined the Hou… | Not supported | Partially supported | Supported | lateral |
| openrouter-gemma-4-26b-a4b | row_19 | By comparison, in the first federal census, in 1790, the pop… | Source unavailable | Not supported | Supported | lateral |
| openrouter-qwen-3-32b | row_19 | By comparison, in the first federal census, in 1790, the pop… | Source unavailable | Not supported | Supported | lateral |
| gemini-2.5-flash | row_68 | The original settlement area contained the site of the Chart… | Supported | Partially supported | Partially supported | improvement |
| hf-qwen3-32b | row_41 | By 21 September, the Houthis declared themselves in control … | Not supported | Supported | Supported | improvement |
| claude-sonnet-4-5 | row_54 | President Maskhadov started a major campaign against hostage… | Partially supported | Supported | Partially supported | regression |
| openrouter-mistral-small-3.2 | row_22 | The Emergency Quota Act was enacted in 1921, limiting immigr… | Source unavailable | Not supported | Partially supported | lateral |
| openrouter-granite-4.1-8b | row_22 | The Emergency Quota Act was enacted in 1921, limiting immigr… | Source unavailable | Not supported | Partially supported | lateral |
| openrouter-qwen-3-32b | row_20 | After an initial wave of immigration from China following th… | Not supported | Partially supported | Not supported | regression |
| openrouter-gemma-4-26b-a4b | row_22 | The Emergency Quota Act was enacted in 1921, limiting immigr… | Source unavailable | Not supported | Partially supported | lateral |
| hf-gpt-oss-20b | row_44 | The rebels signed a deal with the government, prompting Prim… | Supported | Partially supported | Supported | regression |
| claude-sonnet-4-5 | row_61 | AJMN receives public funding from the Qatari government, and… | Partially supported | Not supported | Partially supported | regression |
| openrouter-qwen-3-32b | row_22 | The Emergency Quota Act was enacted in 1921, limiting immigr… | Source unavailable | Not supported | Partially supported | lateral |
| hf-deepseek-v3 | row_45 | However, the group maintained control of key points in the c… | Partially supported | Supported | Supported | improvement |
| gemini-2.5-flash | row_81 | In 1985 he gave the UK premiere of Erich Wolfgang Korngold's… | Supported | Partially supported | Not supported | lateral |
| hf-qwen3-32b | row_48 | The Houthis continued to apply pressure on the weakened unit… | Partially supported | Not supported | Partially supported | regression |
| hf-qwen3-32b | row_47 | Saleh's party, the General People's Congress, joined the Hou… | Partially supported | Not supported | Supported | lateral |
| hf-qwen3-32b | row_51 | On 27 August 1958, Major General Stepanov of the Military Av… | Partially supported | Not supported | Not supported | improvement |
| claude-sonnet-4-5 | row_80 | A key issue in the motion was the Prime Minister's alleged i… | Partially supported | Not supported | Not supported | improvement |
| hf-gpt-oss-20b | row_56 | but the nickname Ginger & Fred is now mainly used for the re… | Partially supported | Not supported | Supported | lateral |
| gemini-2.5-flash | row_105 | Harris's body was cremated, and his ashes were scattered in … | Not supported | Partially supported | Not supported | regression |
| hf-deepseek-v3 | row_56 | but the nickname Ginger & Fred is now mainly used for the re… | Partially supported | Supported | Supported | improvement |
| gemini-2.5-flash | row_106 | Story of the Eye (French: Histoire de l'œil) is a 1928 novel… | Not supported | Partially supported | Not supported | regression |
| openrouter-qwen-3-32b | row_27 | A few weeks later, the Battle of Aden broke out between the … | Partially supported | Supported | Supported | improvement |
| gemini-2.5-flash | row_107 | In 2009, Fennessy founded and became CEO of Standard Media I… | Source unavailable | Not supported | Not supported | improvement |
| openrouter-mistral-small-3.2 | row_29 | On 7 January 2026, Saudi Arabia launched airstrikes against … | Supported | Partially supported | Partially supported | improvement |
| gemini-2.5-flash | row_109 | Olson researched the loss of HMAS Sydney in World War II for… | Source unavailable | Not supported | Not supported | improvement |
| openrouter-granite-4.1-8b | row_29 | On 7 January 2026, Saudi Arabia launched airstrikes against … | Not supported | Partially supported | Partially supported | improvement |
| openrouter-qwen-3-32b | row_29 | On 7 January 2026, Saudi Arabia launched airstrikes against … | Not supported | Partially supported | Partially supported | improvement |
| claude-sonnet-4-5 | row_89 | University Radio York (URY) is the oldest independent radio … | Partially supported | Not supported | Partially supported | regression |
| openrouter-qwen-3-32b | row_30 | PLC forces captured the city's international airport and the… | Supported | Partially supported | Supported | regression |
| hf-gpt-oss-20b | row_64 | The original Al Jazeera Satellite Channel was launched on 1 … | Partially supported | Not supported | Supported | lateral |
| gemini-2.5-flash | row_127 | In May 2025, the New York Times Children’s and Young Adult S… | Partially supported | Supported | Partially supported | regression |
| claude-sonnet-4-5 | row_96 | On 6 March 2024, Welch made his senior debut for the club, r… | Not supported | Partially supported | Not supported | regression |
| openrouter-qwen-3-32b | row_32 | The STC maintains that Zoubaidi remains in Aden. | Partially supported | Supported | Supported | improvement |
| claude-sonnet-4-5 | row_98 | John Zogby was born on September 3, 1948, and grew up in Uti… | Source unavailable | Not supported | Not supported | improvement |
| hf-qwen3-32b | row_68 | The original settlement area contained the site of the Chart… | Partially supported | Supported | Partially supported | regression |
| gemini-2.5-flash | row_132 | Based on polo, two players moved miniature motorbikes around… | Supported | Partially supported | Supported | regression |
| hf-gpt-oss-20b | row_70 | The case continued until 15 December 2025, when the Supreme … | Partially supported | Not supported | Not supported | improvement |
| openrouter-mistral-small-3.2 | row_33 | The Yemeni government charged Zoubaidi with high treason on … | Supported | Partially supported | Supported | regression |
| openrouter-granite-4.1-8b | row_33 | The Yemeni government charged Zoubaidi with high treason on … | Supported | PARSE_ERROR | Supported | regression |
| gemini-2.5-flash | row_137 | LaGuardia Airport, United States, 2025 | Supported | Partially supported | Partially supported | improvement |
| claude-sonnet-4-5 | row_109 | Olson researched the loss of HMAS Sydney in World War II for… | Source unavailable | Not supported | Not supported | improvement |
| openrouter-qwen-3-32b | row_33 | The Yemeni government charged Zoubaidi with high treason on … | Supported | Not supported | Supported | regression |
| claude-sonnet-4-5 | row_106 | Story of the Eye (French: Histoire de l'œil) is a 1928 novel… | Partially supported | Not supported | Not supported | improvement |
| hf-qwen3-32b | row_72 | On 23 July 1992, the Abkhaz faction of Abkhazia's legislativ… | Supported | Partially supported | Partially supported | improvement |
| hf-deepseek-v3 | row_72 | On 23 July 1992, the Abkhaz faction of Abkhazia's legislativ… | Supported | Partially supported | Partially supported | improvement |
| hf-deepseek-v3 | row_74 | On 16 July, the French yacht Dignité Al Karama left the Gree… | Source unavailable | Not supported | Not supported | improvement |
| gemini-2.5-flash | row_153 | Among her characters were Latina bimbo Melina (Lida and Meli… | Not supported | Partially supported | Partially supported | improvement |
| hf-deepseek-v3 | row_75 | According to various estimates, the number of Chechens who a… | Partially supported | Supported | Not supported | lateral |
| hf-qwen3-32b | row_79 | His educational background is in marine biology, and Hemphil… | Source unavailable | Not supported | Not supported | improvement |
| gemini-2.5-flash | row_158 | Its goal is to allow consumers to compare the overall nutrit… | Supported | Partially supported | Partially supported | improvement |
| claude-sonnet-4-5 | row_119 | At the time, he was a member of the House General Investigat… | Partially supported | Supported | Supported | improvement |
| hf-qwen3-32b | row_81 | In 1985 he gave the UK premiere of Erich Wolfgang Korngold's… | Supported | Not supported | Not supported | improvement |
| hf-deepseek-v3 | row_80 | A key issue in the motion was the Prime Minister's alleged i… | Not supported | Partially supported | Not supported | regression |
| gemini-2.5-flash | row_164 | Some mentionable connections and collaborations from this pe… | Source unavailable | Not supported | Not supported | improvement |
| hf-gpt-oss-20b | row_85 | Those who reached Almería were largely rejected by the city’… | Not supported | Partially supported | Partially supported | improvement |
| openrouter-granite-4.1-8b | row_39 | More than 60 were killed in clashes on 19 September. | Not supported | Supported | Supported | improvement |
| openrouter-qwen-3-32b | row_39 | More than 60 were killed in clashes on 19 September. | Supported | Not supported | Supported | regression |
| openrouter-gemma-4-26b-a4b | row_40 | That evening, Benomar announced an agreement that would end … | Partially supported | Not supported | Supported | lateral |
| claude-sonnet-4-5 | row_134 | He has shared his experience through his book- More than jus… | Partially supported | Supported | Supported | improvement |
| openrouter-qwen-3-32b | row_40 | That evening, Benomar announced an agreement that would end … | Not supported | Partially supported | Supported | lateral |
| hf-deepseek-v3 | row_84 | Cenat is Catholic. | Not supported | Partially supported | Not supported | regression |
| gemini-2.5-flash | row_169 | However, it is most often found in open woodlands, along the… | Partially supported | Not supported | Partially supported | regression |
| claude-sonnet-4-5 | row_136 | Only to make the team feel uneasy and are feeling the strong… | Partially supported | Not supported | Supported | lateral |
| hf-gpt-oss-20b | row_90 | In June, Ajnad al-Sham along with more rebel groups led a ne… | Not supported | Partially supported | Not supported | regression |
| gemini-2.5-flash | row_173 | First Nations peoples believe that the berry has many health… | Partially supported | Supported | Partially supported | regression |
| openrouter-granite-4.1-8b | row_41 | By 21 September, the Houthis declared themselves in control … | Supported | Partially supported | Supported | regression |
| openrouter-qwen-3-32b | row_41 | By 21 September, the Houthis declared themselves in control … | Not supported | Supported | Supported | improvement |
| hf-qwen3-32b | row_93 | The economy of Clinton, along with the surrounding Island Co… | Source unavailable | Not supported | Not supported | improvement |
| hf-qwen3-32b | row_94 | A new church was designed by Sir George Gilbert Scott, one o… | Source unavailable | Not supported | Not supported | improvement |
| gemini-2.5-flash | row_183 | The following year, qualification was achieved for the FIFA … | Partially supported | Supported | Partially supported | regression |
| hf-qwen3-32b | row_95 | The global electricity consumption in 2022 was 24,398 terawa… | Source unavailable | Not supported | Partially supported | lateral |
| hf-deepseek-v3 | row_94 | A new church was designed by Sir George Gilbert Scott, one o… | Source unavailable | Not supported | Not supported | improvement |
| hf-gpt-oss-20b | row_97 | Shreve's literary works have been featured in The New Yorker… | Not supported | Partially supported | Partially supported | improvement |
| hf-qwen3-32b | row_98 | John Zogby was born on September 3, 1948, and grew up in Uti… | Source unavailable | Not supported | Not supported | improvement |
| hf-deepseek-v3 | row_98 | John Zogby was born on September 3, 1948, and grew up in Uti… | Source unavailable | Not supported | Not supported | improvement |
| claude-sonnet-4-5 | row_155 | COM is well regarded among communication colleges in the Uni… | Partially supported | Not supported | Not supported | improvement |
| openrouter-qwen-3-32b | row_45 | However, the group maintained control of key points in the c… | Partially supported | Supported | Supported | improvement |
| claude-sonnet-4-5 | row_160 | The Ihimba Hot Springs are situated on kabiulil-Katuna Road,… | Partially supported | Not supported | Partially supported | regression |
| claude-sonnet-4-5 | row_164 | Some mentionable connections and collaborations from this pe… | Source unavailable | Not supported | Not supported | improvement |
| claude-sonnet-4-5 | row_161 | From 1968 through 2004, the majority of North Carolina voter… | Partially supported | Not supported | Partially supported | regression |
| hf-deepseek-v3 | row_107 | In 2009, Fennessy founded and became CEO of Standard Media I… | Source unavailable | Not supported | Not supported | improvement |
| openrouter-granite-4.1-8b | row_48 | The Houthis continued to apply pressure on the weakened unit… | Supported | Partially supported | Partially supported | improvement |
| hf-deepseek-v3 | row_108 | The magazine secures much of its material from "insider" sou… | Source unavailable | Not supported | Not supported | improvement |
| hf-deepseek-v3 | row_109 | Olson researched the loss of HMAS Sydney in World War II for… | Source unavailable | Not supported | Not supported | improvement |
| openrouter-granite-4.1-8b | row_47 | Saleh's party, the General People's Congress, joined the Hou… | Supported | Not supported | Supported | regression |
| hf-gpt-oss-20b | row_113 | The primary reasons for the decrease in injury when looking … | Not supported | Partially supported | Partially supported | improvement |
| hf-qwen3-32b | row_114 | The American Film Institute cites 6 contemporary reviews of … | Not supported | Supported | Supported | improvement |
| hf-deepseek-v3 | row_112 | Since 2013, she has guest-starred in several episodes of Law… | Supported | Partially supported | Partially supported | improvement |
| openrouter-granite-4.1-8b | row_49 | They stepped up their efforts by shelling Hadi's residence a… | Supported | Partially supported | Partially supported | improvement |
| claude-sonnet-4-5 | row_181 | Berguer was born in 1940 in A Coruña, Spain. | Supported | Partially supported | Supported | regression |
| claude-sonnet-4-5 | row_184 | It is managed as part of the Nature Reserve of Orange County… | Not supported | Partially supported | Partially supported | improvement |
| openrouter-gemma-4-26b-a4b | row_51 | On 27 August 1958, Major General Stepanov of the Military Av… | Supported | Partially supported | Not supported | lateral |
| openrouter-mistral-small-3.2 | row_51 | On 27 August 1958, Major General Stepanov of the Military Av… | Supported | Partially supported | Not supported | lateral |
| hf-qwen3-32b | row_127 | In May 2025, the New York Times Children’s and Young Adult S… | Supported | Partially supported | Partially supported | improvement |
| openrouter-granite-4.1-8b | row_51 | On 27 August 1958, Major General Stepanov of the Military Av… | Supported | PARSE_ERROR | Not supported | lateral |
| claude-sonnet-4-5 | row_186 | Combat Zone Wrestling (CZW) is an American independent profe… | Partially supported | Not supported | Partially supported | regression |
| openrouter-qwen-3-32b | row_49 | They stepped up their efforts by shelling Hadi's residence a… | Partially supported | Supported | Partially supported | regression |
| hf-gpt-oss-20b | row_129 | Any movement, especially rapid or unguarded movement, can ag… | Supported | Partially supported | Supported | regression |
| claude-sonnet-4-5 | row_187 | The summit also called upon Israel to relinquish it's occupa… | Partially supported | Supported | Partially supported | regression |
| openrouter-granite-4.1-8b | row_52 | Aslan Maskhadov tried to concentrate power in his hands to e… | Supported | PARSE_ERROR | Partially supported | lateral |
| hf-deepseek-v3 | row_128 | Republicans should be ashamed of exploiting this tragedy for… | Source unavailable | Not supported | Partially supported | lateral |
| openrouter-qwen-3-32b | row_51 | On 27 August 1958, Major General Stepanov of the Military Av… | Partially supported | Not supported | Not supported | improvement |
| hf-gpt-oss-20b | row_132 | Based on polo, two players moved miniature motorbikes around… | Partially supported | Not supported | Supported | lateral |
| hf-qwen3-32b | row_132 | Based on polo, two players moved miniature motorbikes around… | Partially supported | Supported | Supported | improvement |
| hf-qwen3-32b | row_134 | He has shared his experience through his book- More than jus… | Source unavailable | Partially supported | Supported | lateral |
| hf-deepseek-v3 | row_132 | Based on polo, two players moved miniature motorbikes around… | Partially supported | Supported | Supported | improvement |
| hf-deepseek-v3 | row_134 | He has shared his experience through his book- More than jus… | Source unavailable | Supported | Supported | improvement |
| openrouter-granite-4.1-8b | row_54 | President Maskhadov started a major campaign against hostage… | Partially supported | Supported | Partially supported | regression |
| hf-qwen3-32b | row_135 | There, she completed her doctoral training and collaborated … | Partially supported | Supported | Supported | improvement |
| hf-qwen3-32b | row_136 | Only to make the team feel uneasy and are feeling the strong… | Partially supported | Supported | Supported | improvement |
| openrouter-qwen-3-32b | row_54 | President Maskhadov started a major campaign against hostage… | Supported | Partially supported | Partially supported | improvement |
| hf-qwen3-32b | row_138 | Raul is known to be a strong proponent of Flock Safety ALPR … | Supported | Partially supported | Partially supported | improvement |
| hf-deepseek-v3 | row_135 | There, she completed her doctoral training and collaborated … | Partially supported | Not supported | Supported | lateral |
| openrouter-gemma-4-26b-a4b | row_56 | but the nickname Ginger & Fred is now mainly used for the re… | Partially supported | Not supported | Supported | lateral |
| openrouter-granite-4.1-8b | row_57 | Gehry himself later discarded his own idea, as he was "afrai… | Supported | Partially supported | Supported | regression |
| openrouter-gemma-4-26b-a4b | row_59 | In 2016, over the course of five months, two floors of the b… | Partially supported | Supported | Supported | improvement |
| hf-gpt-oss-20b | row_149 | Born in Bermuda, Brunson joined Queens Park Rangers in Decem… | Supported | Partially supported | Supported | regression |
| hf-deepseek-v3 | row_146 | Ibn al‐Bannāʾ al‐Marrākushī (Arabic: ابن البناء المراكشي), f… | Supported | Partially supported | Supported | regression |
| hf-qwen3-32b | row_149 | Born in Bermuda, Brunson joined Queens Park Rangers in Decem… | Partially supported | Supported | Supported | improvement |
| hf-deepseek-v3 | row_150 | Introduced in September 2019, it is chambered in 9×19mm Para… | Supported | Partially supported | Partially supported | improvement |
| hf-qwen3-32b | row_152 | Soundgarden was among one of the first grunge bands to be si… | Supported | Partially supported | Partially supported | improvement |
| openrouter-qwen-3-32b | row_61 | AJMN receives public funding from the Qatari government, and… | Partially supported | Not supported | Partially supported | regression |
| hf-qwen3-32b | row_151 | The team won the North II Group III state sectional champion… | Source unavailable | Partially supported | Partially supported | improvement |
| openrouter-qwen-3-32b | row_60 | AJMN receives public funding from the Qatari government, and… | Not supported | Partially supported | Partially supported | improvement |
| hf-qwen3-32b | row_154 | The club previously played at Estadio El Vivero in the east … | Source unavailable | Partially supported | Not supported | lateral |
| hf-deepseek-v3 | row_151 | The team won the North II Group III state sectional champion… | Not supported | Partially supported | Partially supported | improvement |
| hf-gpt-oss-20b | row_153 | Among her characters were Latina bimbo Melina (Lida and Meli… | Partially supported | Not supported | Partially supported | regression |
| openrouter-mistral-small-3.2 | row_64 | The original Al Jazeera Satellite Channel was launched on 1 … | Supported | Partially supported | Supported | regression |
| openrouter-granite-4.1-8b | row_64 | The original Al Jazeera Satellite Channel was launched on 1 … | Supported | Partially supported | Supported | regression |
| hf-qwen3-32b | row_158 | Its goal is to allow consumers to compare the overall nutrit… | Supported | Partially supported | Partially supported | improvement |
| hf-deepseek-v3 | row_156 | Production of dead burnt magnesite and further value additio… | Source unavailable | Not supported | Not supported | improvement |
| hf-qwen3-32b | row_159 | The college is also recognized as a Military Friendly® Schoo… | Partially supported | Not supported | Partially supported | regression |
| hf-qwen3-32b | row_160 | The Ihimba Hot Springs are situated on kabiulil-Katuna Road,… | Partially supported | Not supported | Partially supported | regression |
| hf-qwen3-32b | row_161 | From 1968 through 2004, the majority of North Carolina voter… | Partially supported | Not supported | Partially supported | regression |
| openrouter-qwen-3-32b | row_64 | The original Al Jazeera Satellite Channel was launched on 1 … | Not supported | Partially supported | Supported | lateral |
| hf-qwen3-32b | row_162 | As of December 2025, OneNote had more than 500M+ downloads o… | Partially supported | Not supported | Not supported | improvement |
| hf-gpt-oss-20b | row_162 | As of December 2025, OneNote had more than 500M+ downloads o… | Not supported | Partially supported | Not supported | regression |
| openrouter-qwen-3-32b | row_65 | Al Jazeera's first day on air was 1 November 1996. It offere… | Supported | Partially supported | Partially supported | improvement |
| hf-qwen3-32b | row_163 | Route 22 Confederation/City Centre (this route operates as n… | Supported | Not supported | Partially supported | lateral |
| hf-qwen3-32b | row_164 | Some mentionable connections and collaborations from this pe… | Source unavailable | Not supported | Not supported | improvement |
| hf-deepseek-v3 | row_164 | Some mentionable connections and collaborations from this pe… | Source unavailable | Not supported | Not supported | improvement |
| hf-gpt-oss-20b | row_167 | Other risk factors for developing adhesive capsulitis includ… | Partially supported | Not supported | Partially supported | regression |
| hf-deepseek-v3 | row_165 | The 1980 NBA Finals was dramatized in the Season 1 of HBO's … | Partially supported | Not supported | Not supported | improvement |
| hf-deepseek-v3 | row_169 | However, it is most often found in open woodlands, along the… | Partially supported | Supported | Partially supported | regression |
| openrouter-granite-4.1-8b | row_69 | On December 15, 1814, delegates from the five New England st… | Supported | PARSE_ERROR | Supported | regression |
| hf-qwen3-32b | row_174 | Future missions may use radiation-resistant fungi-derived pa… | Partially supported | Supported | Not supported | lateral |
| openrouter-qwen-3-32b | row_68 | The original settlement area contained the site of the Chart… | Supported | Not supported | Partially supported | lateral |
| hf-qwen3-32b | row_175 | On November 4, 2025, a reissue of Sequence 01 was announced,… | Partially supported | Not supported | Supported | lateral |
| hf-deepseek-v3 | row_175 | On November 4, 2025, a reissue of Sequence 01 was announced,… | Partially supported | Supported | Supported | improvement |
| hf-deepseek-v3 | row_174 | Future missions may use radiation-resistant fungi-derived pa… | Partially supported | Not supported | Not supported | improvement |
| openrouter-granite-4.1-8b | row_71 | In April 1984, the LTTE formally joined a common militant fr… | Not supported | PARSE_ERROR | Partially supported | lateral |
| openrouter-gemma-4-26b-a4b | row_71 | In April 1984, the LTTE formally joined a common militant fr… | Partially supported | Not supported | Partially supported | regression |
| hf-gpt-oss-20b | row_180 | In 2024, Keoghan publicly announced his relationship with Sa… | Partially supported | Supported | Supported | improvement |
| hf-gpt-oss-20b | row_179 | These groups are fighting for gender equailty and continuing… | Not supported | Partially supported | Partially supported | improvement |
| hf-deepseek-v3 | row_182 | Her father (Rameshwar) wanted a son, but despite being a gir… | Not supported | Partially supported | Partially supported | improvement |
| hf-gpt-oss-20b | row_186 | Combat Zone Wrestling (CZW) is an American independent profe… | Partially supported | Not supported | Partially supported | regression |
| hf-qwen3-32b | row_187 | The summit also called upon Israel to relinquish it's occupa… | Supported | Partially supported | Partially supported | improvement |
| hf-deepseek-v3 | row_184 | It is managed as part of the Nature Reserve of Orange County… | Partially supported | Not supported | Partially supported | regression |
| openrouter-mistral-small-3.2 | row_74 | On 16 July, the French yacht Dignité Al Karama left the Gree… | Source unavailable | Not supported | Not supported | improvement |
| hf-deepseek-v3 | row_189 | ISBN 9781936393466. | Source unavailable | Not supported | Supported | lateral |
| openrouter-qwen-3-32b | row_74 | On 16 July, the French yacht Dignité Al Karama left the Gree… | Not supported | Supported | Not supported | regression |
| openrouter-granite-4.1-8b | row_75 | According to various estimates, the number of Chechens who a… | Supported | PARSE_ERROR | Not supported | lateral |
| openrouter-mistral-small-3.2 | row_76 | In 2002, Rwanda's situation in the war began to worsen. Many… | Partially supported | Supported | Not supported | lateral |
| openrouter-gemma-4-26b-a4b | row_76 | In 2002, Rwanda's situation in the war began to worsen. Many… | Partially supported | Not supported | Not supported | improvement |
| openrouter-mistral-small-3.2 | row_80 | A key issue in the motion was the Prime Minister's alleged i… | Partially supported | Not supported | Not supported | improvement |
| openrouter-granite-4.1-8b | row_79 | His educational background is in marine biology, and Hemphil… | Not supported | Partially supported | Not supported | regression |
| openrouter-mistral-small-3.2 | row_81 | In 1985 he gave the UK premiere of Erich Wolfgang Korngold's… | Source unavailable | Not supported | Not supported | improvement |
| openrouter-granite-4.1-8b | row_81 | In 1985 he gave the UK premiere of Erich Wolfgang Korngold's… | Supported | Not supported | Not supported | improvement |
| openrouter-mistral-small-3.2 | row_82 | Joseph Constant, sculptor and writer | Source unavailable | Not supported | Not supported | improvement |
| openrouter-granite-4.1-8b | row_83 | Retired Australian Army Major General Mick Ryan characterize… | Supported | Not supported | Partially supported | lateral |
| openrouter-qwen-3-32b | row_82 | Joseph Constant, sculptor and writer | Source unavailable | Not supported | Not supported | improvement |
| openrouter-granite-4.1-8b | row_84 | Cenat is Catholic. | Partially supported | Not supported | Not supported | improvement |
| openrouter-granite-4.1-8b | row_85 | Those who reached Almería were largely rejected by the city’… | Not supported | PARSE_ERROR | Partially supported | lateral |
| openrouter-mistral-small-3.2 | row_87 | It was the unofficial remake of Hollywood film Love Actually… | Source unavailable | Not supported | Not supported | improvement |
| openrouter-granite-4.1-8b | row_88 | Kask died after a short illness on December 30, 2025, at the… | Supported | Partially supported | Supported | regression |
| openrouter-gemma-4-26b-a4b | row_88 | Kask died after a short illness on December 30, 2025, at the… | Partially supported | Supported | Supported | improvement |
| openrouter-granite-4.1-8b | row_91 | The brigade has faced accusations of human rights abuses, in… | Partially supported | PARSE_ERROR | Not supported | lateral |
| openrouter-mistral-small-3.2 | row_94 | A new church was designed by Sir George Gilbert Scott, one o… | Source unavailable | Not supported | Not supported | improvement |
| openrouter-granite-4.1-8b | row_94 | A new church was designed by Sir George Gilbert Scott, one o… | Source unavailable | PARSE_ERROR | Not supported | lateral |
| openrouter-gemma-4-26b-a4b | row_94 | A new church was designed by Sir George Gilbert Scott, one o… | Source unavailable | Not supported | Not supported | improvement |
| openrouter-mistral-small-3.2 | row_95 | The global electricity consumption in 2022 was 24,398 terawa… | Source unavailable | Not supported | Partially supported | lateral |
| openrouter-mistral-small-3.2 | row_96 | On 6 March 2024, Welch made his senior debut for the club, r… | Partially supported | Not supported | Not supported | improvement |
| openrouter-qwen-3-32b | row_95 | The global electricity consumption in 2022 was 24,398 terawa… | Source unavailable | Not supported | Partially supported | lateral |
| openrouter-gemma-4-26b-a4b | row_97 | Shreve's literary works have been featured in The New Yorker… | Not supported | Partially supported | Partially supported | improvement |
| openrouter-qwen-3-32b | row_94 | A new church was designed by Sir George Gilbert Scott, one o… | Source unavailable | Not supported | Not supported | improvement |
| openrouter-mistral-small-3.2 | row_100 | and the Minister of Interior in the Syrian transitional gove… | Partially supported | Supported | Not supported | lateral |
| openrouter-mistral-small-3.2 | row_101 | However, it has been since extended indefinitely. | Source unavailable | Not supported | Not supported | improvement |
| openrouter-mistral-small-3.2 | row_102 | and classified among "R1: Doctoral Universities – Very high … | Not supported | Partially supported | Partially supported | improvement |
| openrouter-qwen-3-32b | row_102 | and classified among "R1: Doctoral Universities – Very high … | Not supported | Partially supported | Partially supported | improvement |
| openrouter-mistral-small-3.2 | row_104 | As of December 2024, the company operates six locations: one… | Not supported | Partially supported | Not supported | regression |
| openrouter-qwen-3-32b | row_103 | Varisu and Animal rank among the highest-grossing Indian fil… | Partially supported | Not supported | Not supported | improvement |
| openrouter-qwen-3-32b | row_105 | Harris's body was cremated, and his ashes were scattered in … | Partially supported | Not supported | Not supported | improvement |
| openrouter-gemma-4-26b-a4b | row_107 | In 2009, Fennessy founded and became CEO of Standard Media I… | Source unavailable | Not supported | Not supported | improvement |
| openrouter-mistral-small-3.2 | row_107 | In 2009, Fennessy founded and became CEO of Standard Media I… | Source unavailable | Not supported | Not supported | improvement |
| openrouter-mistral-small-3.2 | row_108 | The magazine secures much of its material from "insider" sou… | Source unavailable | Not supported | Not supported | improvement |
| openrouter-mistral-small-3.2 | row_110 | The song is based on a poem written by a young Oklahoma war … | Source unavailable | Not supported | Not supported | improvement |
| openrouter-granite-4.1-8b | row_112 | Since 2013, she has guest-starred in several episodes of Law… | Not supported | Supported | Partially supported | lateral |
| openrouter-qwen-3-32b | row_109 | Olson researched the loss of HMAS Sydney in World War II for… | Source unavailable | Not supported | Not supported | improvement |
| openrouter-granite-4.1-8b | row_114 | The American Film Institute cites 6 contemporary reviews of … | Supported | PARSE_ERROR | Supported | regression |
| openrouter-mistral-small-3.2 | row_114 | The American Film Institute cites 6 contemporary reviews of … | Partially supported | Supported | Supported | improvement |
| openrouter-granite-4.1-8b | row_119 | At the time, he was a member of the House General Investigat… | Supported | PARSE_ERROR | Supported | regression |
| openrouter-gemma-4-26b-a4b | row_127 | In May 2025, the New York Times Children’s and Young Adult S… | Partially supported | Supported | Partially supported | regression |
| openrouter-granite-4.1-8b | row_127 | In May 2025, the New York Times Children’s and Young Adult S… | Supported | Partially supported | Partially supported | improvement |
| openrouter-qwen-3-32b | row_127 | In May 2025, the New York Times Children’s and Young Adult S… | Partially supported | Supported | Partially supported | regression |
| openrouter-granite-4.1-8b | row_132 | Based on polo, two players moved miniature motorbikes around… | Supported | PARSE_ERROR | Supported | regression |
| openrouter-qwen-3-32b | row_132 | Based on polo, two players moved miniature motorbikes around… | Supported | Partially supported | Supported | regression |
| openrouter-mistral-small-3.2 | row_134 | He has shared his experience through his book- More than jus… | Source unavailable | Partially supported | Supported | lateral |
| openrouter-granite-4.1-8b | row_136 | Only to make the team feel uneasy and are feeling the strong… | Not supported | Partially supported | Supported | lateral |
| openrouter-granite-4.1-8b | row_137 | LaGuardia Airport, United States, 2025 | Not supported | Supported | Partially supported | lateral |
| openrouter-granite-4.1-8b | row_139 | Anthony Hudson, artist known for drag clown persona Carla Ro… | Supported | PARSE_ERROR | Supported | regression |
| openrouter-qwen-3-32b | row_134 | He has shared his experience through his book- More than jus… | Source unavailable | Partially supported | Supported | lateral |
| openrouter-qwen-3-32b | row_141 | She became a full member of the European Parliament Committe… | Supported | Partially supported | Supported | regression |
| openrouter-mistral-small-3.2 | row_147 | A review of the Arlacchi plan has been carried out in March … | Source unavailable | Not supported | Not supported | improvement |
| openrouter-qwen-3-32b | row_138 | Raul is known to be a strong proponent of Flock Safety ALPR … | Supported | Partially supported | Partially supported | improvement |
| openrouter-mistral-small-3.2 | row_148 | Intrigued by the foul odors, Lukas declined the offer and le… | Source unavailable | Not supported | Not supported | improvement |
| openrouter-granite-4.1-8b | row_148 | Intrigued by the foul odors, Lukas declined the offer and le… | Not supported | PARSE_ERROR | Not supported | regression |
| openrouter-qwen-3-32b | row_152 | Soundgarden was among one of the first grunge bands to be si… | Partially supported | Supported | Partially supported | regression |
| openrouter-granite-4.1-8b | row_154 | The club previously played at Estadio El Vivero in the east … | Not supported | PARSE_ERROR | Not supported | regression |
| openrouter-qwen-3-32b | row_154 | The club previously played at Estadio El Vivero in the east … | Partially supported | Not supported | Not supported | improvement |
| openrouter-gemma-4-26b-a4b | row_153 | Among her characters were Latina bimbo Melina (Lida and Meli… | Not supported | Partially supported | Partially supported | improvement |
| openrouter-mistral-small-3.2 | row_156 | Production of dead burnt magnesite and further value additio… | Source unavailable | Not supported | Not supported | improvement |
| openrouter-granite-4.1-8b | row_156 | Production of dead burnt magnesite and further value additio… | Not supported | PARSE_ERROR | Not supported | regression |
| openrouter-mistral-small-3.2 | row_157 | During recovery, he would watch Janet Jackson's video anthol… | Supported | Partially supported | Partially supported | improvement |
| openrouter-granite-4.1-8b | row_157 | During recovery, he would watch Janet Jackson's video anthol… | Partially supported | Not supported | Partially supported | regression |
| openrouter-gemma-4-26b-a4b | row_158 | Its goal is to allow consumers to compare the overall nutrit… | Not supported | Partially supported | Partially supported | improvement |
| openrouter-qwen-3-32b | row_155 | COM is well regarded among communication colleges in the Uni… | Source unavailable | Not supported | Not supported | improvement |
| openrouter-granite-4.1-8b | row_158 | Its goal is to allow consumers to compare the overall nutrit… | Supported | Partially supported | Partially supported | improvement |
| openrouter-qwen-3-32b | row_158 | Its goal is to allow consumers to compare the overall nutrit… | Supported | Partially supported | Partially supported | improvement |
| openrouter-mistral-small-3.2 | row_160 | The Ihimba Hot Springs are situated on kabiulil-Katuna Road,… | Supported | Not supported | Partially supported | lateral |
| openrouter-gemma-4-26b-a4b | row_160 | The Ihimba Hot Springs are situated on kabiulil-Katuna Road,… | Not supported | Partially supported | Partially supported | improvement |
| openrouter-granite-4.1-8b | row_160 | The Ihimba Hot Springs are situated on kabiulil-Katuna Road,… | Partially supported | Supported | Partially supported | regression |
| openrouter-gemma-4-26b-a4b | row_163 | Route 22 Confederation/City Centre (this route operates as n… | Supported | Partially supported | Partially supported | improvement |
| openrouter-mistral-small-3.2 | row_164 | Some mentionable connections and collaborations from this pe… | Source unavailable | Not supported | Not supported | improvement |
| openrouter-granite-4.1-8b | row_164 | Some mentionable connections and collaborations from this pe… | Source unavailable | PARSE_ERROR | Not supported | lateral |
| openrouter-gemma-4-26b-a4b | row_164 | Some mentionable connections and collaborations from this pe… | Source unavailable | Not supported | Not supported | improvement |
| openrouter-granite-4.1-8b | row_165 | The 1980 NBA Finals was dramatized in the Season 1 of HBO's … | Not supported | Partially supported | Not supported | regression |
| openrouter-qwen-3-32b | row_162 | As of December 2025, OneNote had more than 500M+ downloads o… | Partially supported | Supported | Not supported | lateral |
| openrouter-granite-4.1-8b | row_166 | O'Neal, president of the American Farm Bureau, Duncan eventu… | Not supported | PARSE_ERROR | Not supported | regression |
| openrouter-qwen-3-32b | row_164 | Some mentionable connections and collaborations from this pe… | Source unavailable | Not supported | Not supported | improvement |
| openrouter-mistral-small-3.2 | row_168 | The district encompasses an area of roughly 84 square miles … | Supported | Partially supported | Partially supported | improvement |
| openrouter-granite-4.1-8b | row_168 | The district encompasses an area of roughly 84 square miles … | Supported | Partially supported | Partially supported | improvement |
| openrouter-mistral-small-3.2 | row_169 | However, it is most often found in open woodlands, along the… | Supported | Partially supported | Partially supported | improvement |
| openrouter-gemma-4-26b-a4b | row_168 | The district encompasses an area of roughly 84 square miles … | Not supported | Partially supported | Partially supported | improvement |
| openrouter-qwen-3-32b | row_168 | The district encompasses an area of roughly 84 square miles … | Partially supported | Not supported | Partially supported | regression |
| openrouter-granite-4.1-8b | row_170 | The film was based on a real-life incident of a friend of Ba… | Supported | Not supported | Not supported | improvement |
| openrouter-granite-4.1-8b | row_171 | United Records operated during a period of rapid growth in t… | Not supported | Partially supported | Not supported | regression |
| openrouter-granite-4.1-8b | row_173 | First Nations peoples believe that the berry has many health… | Supported | Partially supported | Partially supported | improvement |
| openrouter-qwen-3-32b | row_173 | First Nations peoples believe that the berry has many health… | Partially supported | Supported | Partially supported | regression |
| openrouter-granite-4.1-8b | row_174 | Future missions may use radiation-resistant fungi-derived pa… | Supported | Partially supported | Not supported | lateral |
| openrouter-mistral-small-3.2 | row_177 | As of 2025, the Final Fantasy series was won 10 awards at Th… | Partially supported | Not supported | Not supported | improvement |
| openrouter-mistral-small-3.2 | row_179 | These groups are fighting for gender equailty and continuing… | Supported | Partially supported | Partially supported | improvement |
| openrouter-qwen-3-32b | row_179 | These groups are fighting for gender equailty and continuing… | Supported | Partially supported | Partially supported | improvement |
| openrouter-gemma-4-26b-a4b | row_180 | In 2024, Keoghan publicly announced his relationship with Sa… | Partially supported | Supported | Supported | improvement |
| openrouter-granite-4.1-8b | row_180 | In 2024, Keoghan publicly announced his relationship with Sa… | Supported | PARSE_ERROR | Supported | regression |
| openrouter-qwen-3-32b | row_182 | Her father (Rameshwar) wanted a son, but despite being a gir… | Supported | Partially supported | Partially supported | improvement |
| openrouter-gemma-4-26b-a4b | row_184 | It is managed as part of the Nature Reserve of Orange County… | Partially supported | Not supported | Partially supported | regression |
| openrouter-qwen-3-32b | row_184 | It is managed as part of the Nature Reserve of Orange County… | Supported | Partially supported | Partially supported | improvement |
| openrouter-mistral-small-3.2 | row_189 | ISBN 9781936393466. | Source unavailable | Not supported | Supported | lateral |
