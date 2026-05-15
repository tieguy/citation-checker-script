# Compare Results — 2026-05-15T19:41:27.524Z

Change axes: `verifier`, `prompt`
Control run at: 2026-05-14T03:39:58.096Z
Treatment run at: 2026-05-15T19:26:34.418Z

Compared cells: **1554** of 1635 intersection (12 control-only, 27 treatment-only excluded). Dataset: 176 valid of 189.
Noise floor: ±5pp (single-provider 95% CI heuristic).

## Headline accuracy

| Provider | n | Control exact | Treatment exact | Δ exact | Control lenient | Treatment lenient | Δ lenient | Control binary | Treatment binary | Δ binary |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| hf-gpt-oss-20b | 158 | 62.0% | 48.1% | -13.9 | 75.9% | 63.9% | -12.0 | 75.9% | 63.9% | -12.0 |
| hf-qwen3-32b | 176 | 68.2% | 54.5% | -13.6 | 83.5% | 75.6% | -8.0 | 84.1% | 75.6% | -8.5 |
| openrouter-mistral-small-3.2 (noise) | 176 | 60.2% | 60.2% | +0.0 | 79.5% | 80.1% | +0.6 | 79.5% | 80.1% | +0.6 |
| hf-deepseek-v3 | 176 | 71.6% | 64.2% | -7.4 | 84.1% | 81.8% | -2.3 | 84.1% | 81.8% | -2.3 |
| claude-sonnet-4-5 (noise) | 176 | 59.7% | 58.5% | -1.1 | 77.8% | 76.7% | -1.1 | 77.8% | 76.7% | -1.1 |
| gemini-2.5-flash | 167 | 67.7% | 62.3% | -5.4 | 83.2% | 78.4% | -4.8 | 83.2% | 78.4% | -4.8 |
| openrouter-gemma-4-26b-a4b | 176 | 61.4% | 54.5% | -6.8 | 77.8% | 73.9% | -4.0 | 77.8% | 73.9% | -4.0 |
| openrouter-qwen-3-32b | 174 | 68.4% | 56.3% | -12.1 | 83.9% | 77.6% | -6.3 | 83.9% | 77.6% | -6.3 |
| openrouter-granite-4.1-8b | 175 | 63.4% | 57.7% | -5.7 | 81.7% | 78.9% | -2.9 | 81.7% | 78.9% | -2.9 |

## Flips

| Provider | Entry ID | Claim | Control | Treatment | Ground truth | Direction |
|---|---|---|---|---|---|---|
| openrouter-mistral-small-3.2 | row_2 | Immigration has been a major source of population growth and… | Supported | PARTIALLY SUPPORTED | Supported | regression |
| hf-deepseek-v3 | row_2 | Immigration has been a major source of population growth and… | Supported | PARTIALLY SUPPORTED | Supported | regression |
| gemini-2.5-flash | row_4 | In March 2025, the Federation for American Immigration Refor… | Supported | PARTIALLY SUPPORTED | Supported | regression |
| hf-gpt-oss-20b | row_4 | In March 2025, the Federation for American Immigration Refor… | Supported | PARTIALLY SUPPORTED | Supported | regression |
| hf-qwen3-32b | row_4 | In March 2025, the Federation for American Immigration Refor… | Supported | PARTIALLY SUPPORTED | Supported | regression |
| openrouter-mistral-small-3.2 | row_3 | While the United States represented about 4% of the total gl… | Supported | NOT SUPPORTED | Supported | regression |
| gemini-2.5-flash | row_5 | In 2024, immigrants and their U.S.-born children number more… | Partially supported | NOT SUPPORTED | Partially supported | regression |
| hf-deepseek-v3 | row_4 | In March 2025, the Federation for American Immigration Refor… | Supported | PARTIALLY SUPPORTED | Supported | regression |
| hf-gpt-oss-20b | row_6 | According to the 2016 Yearbook of Immigration Statistics, th… | Supported | NOT SUPPORTED | Supported | regression |
| hf-qwen3-32b | row_6 | According to the 2016 Yearbook of Immigration Statistics, th… | Supported | PARTIALLY SUPPORTED | Supported | regression |
| gemini-2.5-flash | row_9 | of these ethnic quotas with per-country limits for family-sp… | Partially supported | NOT SUPPORTED | Supported | lateral |
| gemini-2.5-flash | row_7 | and 1.0% who were granted the Special Immigrant Visa (SIV) f… | Not supported | PARTIALLY SUPPORTED | Supported | lateral |
| hf-deepseek-v3 | row_5 | In 2024, immigrants and their U.S.-born children number more… | Not supported | PARTIALLY SUPPORTED | Partially supported | improvement |
| openrouter-mistral-small-3.2 | row_4 | In March 2025, the Federation for American Immigration Refor… | Supported | PARTIALLY SUPPORTED | Supported | regression |
| claude-sonnet-4-5 | row_9 | of these ethnic quotas with per-country limits for family-sp… | Supported | NOT SUPPORTED | Supported | regression |
| claude-sonnet-4-5 | row_7 | and 1.0% who were granted the Special Immigrant Visa (SIV) f… | Not supported | PARTIALLY SUPPORTED | Supported | lateral |
| hf-deepseek-v3 | row_6 | According to the 2016 Yearbook of Immigration Statistics, th… | Supported | PARTIALLY SUPPORTED | Supported | regression |
| openrouter-gemma-4-26b-a4b | row_4 | In March 2025, the Federation for American Immigration Refor… | Supported | PARTIALLY SUPPORTED | Supported | regression |
| hf-gpt-oss-20b | row_9 | of these ethnic quotas with per-country limits for family-sp… | Supported | NOT SUPPORTED | Supported | regression |
| hf-qwen3-32b | row_9 | of these ethnic quotas with per-country limits for family-sp… | Partially supported | NOT SUPPORTED | Supported | lateral |
| hf-deepseek-v3 | row_9 | of these ethnic quotas with per-country limits for family-sp… | Supported | NOT SUPPORTED | Supported | regression |
| claude-sonnet-4-5 | row_10 | Census estimates show 45.3 million foreign born residents in… | Not supported | PARTIALLY SUPPORTED | Partially supported | improvement |
| openrouter-qwen-3-32b | row_4 | In March 2025, the Federation for American Immigration Refor… | Supported | PARTIALLY SUPPORTED | Supported | regression |
| hf-gpt-oss-20b | row_13 | Causes of migration include poverty, crime | Supported | NOT SUPPORTED | Supported | regression |
| hf-qwen3-32b | row_13 | Causes of migration include poverty, crime | Supported | PARTIALLY SUPPORTED | Supported | regression |
| claude-sonnet-4-5 | row_16 | Over half of all European immigrants to Colonial America dur… | Supported | NOT SUPPORTED | Supported | regression |
| openrouter-mistral-small-3.2 | row_6 | According to the 2016 Yearbook of Immigration Statistics, th… | Supported | PARTIALLY SUPPORTED | Supported | regression |
| hf-gpt-oss-20b | row_16 | Over half of all European immigrants to Colonial America dur… | Supported | NOT SUPPORTED | Supported | regression |
| hf-gpt-oss-20b | row_19 | By comparison, in the first federal census, in 1790, the pop… | Supported | PARTIALLY SUPPORTED | Supported | regression |
| claude-sonnet-4-5 | row_18 | Historians estimate that fewer than one million immigrants m… | Not supported | SUPPORTED | Partially supported | lateral |
| gemini-2.5-flash | row_19 | By comparison, in the first federal census, in 1790, the pop… | Supported | PARTIALLY SUPPORTED | Supported | regression |
| hf-qwen3-32b | row_20 | After an initial wave of immigration from China following th… | Supported | NOT SUPPORTED | Not supported | improvement |
| openrouter-qwen-3-32b | row_6 | According to the 2016 Yearbook of Immigration Statistics, th… | Supported | PARTIALLY SUPPORTED | Supported | regression |
| gemini-2.5-flash | row_24 | On 7 January 2026, Yemeni government forces (Presidential Le… | Not supported | PARTIALLY SUPPORTED | Supported | lateral |
| claude-sonnet-4-5 | row_21 | The peak year of European immigration was in 1907, when 1,28… | Supported | PARTIALLY SUPPORTED | Supported | regression |
| claude-sonnet-4-5 | row_25 | Following Aden's capture, the secretary-general of the STC a… | Partially supported | NOT SUPPORTED | Supported | lateral |
| claude-sonnet-4-5 | row_27 | A few weeks later, the Battle of Aden broke out between the … | Partially supported | NOT SUPPORTED | Supported | lateral |
| hf-gpt-oss-20b | row_25 | Following Aden's capture, the secretary-general of the STC a… | Partially supported | NOT SUPPORTED | Supported | lateral |
| openrouter-qwen-3-32b | row_7 | and 1.0% who were granted the Special Immigrant Visa (SIV) f… | Partially supported | NOT SUPPORTED | Supported | lateral |
| hf-qwen3-32b | row_27 | A few weeks later, the Battle of Aden broke out between the … | Partially supported | NOT SUPPORTED | Supported | lateral |
| gemini-2.5-flash | row_30 | PLC forces captured the city's international airport and the… | Supported | PARTIALLY SUPPORTED | Supported | regression |
| hf-deepseek-v3 | row_26 | Aden has changed hands several times over the course of the … | Supported | PARTIALLY SUPPORTED | Supported | regression |
| openrouter-mistral-small-3.2 | row_9 | of these ethnic quotas with per-country limits for family-sp… | Supported | PARTIALLY SUPPORTED | Supported | regression |
| claude-sonnet-4-5 | row_30 | PLC forces captured the city's international airport and the… | Supported | PARTIALLY SUPPORTED | Supported | regression |
| hf-deepseek-v3 | row_27 | A few weeks later, the Battle of Aden broke out between the … | Supported | PARTIALLY SUPPORTED | Supported | regression |
| hf-gpt-oss-20b | row_28 | On 7 January, the Saudi-backed forces began advancing toward… | Partially supported | SUPPORTED | Supported | improvement |
| gemini-2.5-flash | row_31 | After Aden's fall to the PLC, Zoubaidi went missing for a br… | Partially supported | SUPPORTED | Supported | improvement |
| hf-qwen3-32b | row_30 | PLC forces captured the city's international airport and the… | Supported | PARTIALLY SUPPORTED | Supported | regression |
| hf-deepseek-v3 | row_31 | After Aden's fall to the PLC, Zoubaidi went missing for a br… | Supported | PARTIALLY SUPPORTED | Supported | regression |
| openrouter-mistral-small-3.2 | row_11 | In 2017, out of the U.S. foreign-born population, some 45% (… | Supported | PARTIALLY SUPPORTED | Partially supported | improvement |
| gemini-2.5-flash | row_40 | That evening, Benomar announced an agreement that would end … | Not supported | PARTIALLY SUPPORTED | Supported | lateral |
| gemini-2.5-flash | row_33 | The Yemeni government charged Zoubaidi with high treason on … | Partially supported | NOT SUPPORTED | Supported | lateral |
| claude-sonnet-4-5 | row_33 | The Yemeni government charged Zoubaidi with high treason on … | Partially supported | NOT SUPPORTED | Supported | lateral |
| hf-qwen3-32b | row_33 | The Yemeni government charged Zoubaidi with high treason on … | Supported | NOT SUPPORTED | Supported | regression |
| openrouter-gemma-4-26b-a4b | row_9 | of these ethnic quotas with per-country limits for family-sp… | Partially supported | NOT SUPPORTED | Supported | lateral |
| claude-sonnet-4-5 | row_39 | More than 60 were killed in clashes on 19 September. | Supported | NOT SUPPORTED | Supported | regression |
| hf-gpt-oss-20b | row_34 | The flag of Yemen was raised over government buildings in th… | Supported | NOT SUPPORTED | Supported | regression |
| hf-deepseek-v3 | row_33 | The Yemeni government charged Zoubaidi with high treason on … | Partially supported | NOT SUPPORTED | Supported | lateral |
| hf-gpt-oss-20b | row_36 | In August, the Houthis began holding mass demonstrations in … | Supported | PARTIALLY SUPPORTED | Supported | regression |
| openrouter-mistral-small-3.2 | row_12 | The United States led the world in refugee resettlement for … | Supported | PARTIALLY SUPPORTED | Supported | regression |
| hf-qwen3-32b | row_37 | Fighting broke out between the Houthis and army units in nor… | Supported | PARTIALLY SUPPORTED | Supported | regression |
| hf-gpt-oss-20b | row_37 | Fighting broke out between the Houthis and army units in nor… | Supported | PARTIALLY SUPPORTED | Supported | regression |
| hf-gpt-oss-20b | row_38 | Flights into and out of Sanaa International Airport were sus… | Partially supported | NOT SUPPORTED | Supported | lateral |
| gemini-2.5-flash | row_44 | The rebels signed a deal with the government, prompting Prim… | Supported | PARTIALLY SUPPORTED | Supported | regression |
| claude-sonnet-4-5 | row_45 | However, the group maintained control of key points in the c… | Supported | PARTIALLY SUPPORTED | Supported | regression |
| openrouter-qwen-3-32b | row_12 | The United States led the world in refugee resettlement for … | Supported | PARTIALLY SUPPORTED | Supported | regression |
| hf-qwen3-32b | row_40 | That evening, Benomar announced an agreement that would end … | Not supported | PARTIALLY SUPPORTED | Supported | lateral |
| hf-gpt-oss-20b | row_40 | That evening, Benomar announced an agreement that would end … | Not supported | PARTIALLY SUPPORTED | Supported | lateral |
| claude-sonnet-4-5 | row_42 | having taken over the offices of the prime minister, the sta… | Partially supported | SUPPORTED | Partially supported | regression |
| gemini-2.5-flash | row_46 | Al Jazeera later claimed to have received taped phone conver… | Supported | PARTIALLY SUPPORTED | Supported | regression |
| claude-sonnet-4-5 | row_48 | The Houthis continued to apply pressure on the weakened unit… | Supported | PARTIALLY SUPPORTED | Supported | regression |
| claude-sonnet-4-5 | row_49 | They stepped up their efforts by shelling Hadi's residence a… | Supported | PARTIALLY SUPPORTED | Partially supported | improvement |
| claude-sonnet-4-5 | row_50 | In the 1930s, Chechnya was flooded with multiple Ukrainians … | Supported | PARTIALLY SUPPORTED | Partially supported | improvement |
| hf-qwen3-32b | row_41 | By 21 September, the Houthis declared themselves in control … | Partially supported | NOT SUPPORTED | Supported | lateral |
| claude-sonnet-4-5 | row_52 | Aslan Maskhadov tried to concentrate power in his hands to e… | Supported | PARTIALLY SUPPORTED | Partially supported | improvement |
| openrouter-qwen-3-32b | row_13 | Causes of migration include poverty, crime | Supported | NOT SUPPORTED | Supported | regression |
| claude-sonnet-4-5 | row_47 | Saleh's party, the General People's Congress, joined the Hou… | Not supported | PARTIALLY SUPPORTED | Supported | lateral |
| gemini-2.5-flash | row_47 | Saleh's party, the General People's Congress, joined the Hou… | Supported | PARTIALLY SUPPORTED | Supported | regression |
| hf-qwen3-32b | row_44 | The rebels signed a deal with the government, prompting Prim… | Supported | PARTIALLY SUPPORTED | Supported | regression |
| hf-gpt-oss-20b | row_44 | The rebels signed a deal with the government, prompting Prim… | Supported | PARTIALLY SUPPORTED | Supported | regression |
| claude-sonnet-4-5 | row_53 | but victims were rarely killed. | Not supported | SUPPORTED | Supported | improvement |
| claude-sonnet-4-5 | row_54 | President Maskhadov started a major campaign against hostage… | Partially supported | SUPPORTED | Supported | improvement |
| claude-sonnet-4-5 | row_55 | Gehry originally called the house Ginger and Fred (after the… | Not supported | PARTIALLY SUPPORTED | Supported | lateral |
| hf-gpt-oss-20b | row_45 | However, the group maintained control of key points in the c… | Not supported | PARTIALLY SUPPORTED | Supported | lateral |
| gemini-2.5-flash | row_56 | but the nickname Ginger & Fred is now mainly used for the re… | Partially supported | NOT SUPPORTED | Supported | lateral |
| claude-sonnet-4-5 | row_56 | but the nickname Ginger & Fred is now mainly used for the re… | Supported | NOT SUPPORTED | Supported | regression |
| hf-qwen3-32b | row_46 | Al Jazeera later claimed to have received taped phone conver… | Supported | PARTIALLY SUPPORTED | Supported | regression |
| openrouter-qwen-3-32b | row_15 | During the 17th century, approximately 400,000 English peopl… | Not supported | PARTIALLY SUPPORTED | Supported | lateral |
| claude-sonnet-4-5 | row_57 | Gehry himself later discarded his own idea, as he was "afrai… | Supported | PARTIALLY SUPPORTED | Supported | regression |
| openrouter-gemma-4-26b-a4b | row_16 | Over half of all European immigrants to Colonial America dur… | Supported | NOT SUPPORTED | Supported | regression |
| openrouter-qwen-3-32b | row_19 | By comparison, in the first federal census, in 1790, the pop… | Supported | PARTIALLY SUPPORTED | Supported | regression |
| hf-qwen3-32b | row_49 | They stepped up their efforts by shelling Hadi's residence a… | Partially supported | NOT SUPPORTED | Partially supported | regression |
| gemini-2.5-flash | row_66 | In 2005, the Qatari officials were reportedly so concerned b… | Supported | PARTIALLY SUPPORTED | Supported | regression |
| hf-gpt-oss-20b | row_47 | Saleh's party, the General People's Congress, joined the Hou… | Not supported | PARTIALLY SUPPORTED | Supported | lateral |
| claude-sonnet-4-5 | row_67 | As the Puritan minister in Hartford, Thomas Hooker wielded a… | Supported | PARTIALLY SUPPORTED | Supported | regression |
| hf-deepseek-v3 | row_47 | Saleh's party, the General People's Congress, joined the Hou… | Supported | PARTIALLY SUPPORTED | Supported | regression |
| hf-qwen3-32b | row_51 | On 27 August 1958, Major General Stepanov of the Military Av… | Not supported | PARTIALLY SUPPORTED | Supported | lateral |
| openrouter-qwen-3-32b | row_21 | The peak year of European immigration was in 1907, when 1,28… | Partially supported | SUPPORTED | Supported | improvement |
| claude-sonnet-4-5 | row_65 | Al Jazeera's first day on air was 1 November 1996. It offere… | Supported | PARTIALLY SUPPORTED | Partially supported | improvement |
| hf-deepseek-v3 | row_51 | On 27 August 1958, Major General Stepanov of the Military Av… | Supported | PARTIALLY SUPPORTED | Supported | regression |
| hf-gpt-oss-20b | row_56 | but the nickname Ginger & Fred is now mainly used for the re… | Partially supported | NOT SUPPORTED | Supported | lateral |
| hf-qwen3-32b | row_57 | Gehry himself later discarded his own idea, as he was "afrai… | Supported | PARTIALLY SUPPORTED | Supported | regression |
| gemini-2.5-flash | row_83 | Retired Australian Army Major General Mick Ryan characterize… | Supported | PARTIALLY SUPPORTED | Partially supported | improvement |
| hf-qwen3-32b | row_59 | In 2016, over the course of five months, two floors of the b… | Supported | PARTIALLY SUPPORTED | Supported | regression |
| claude-sonnet-4-5 | row_75 | According to various estimates, the number of Chechens who a… | Partially supported | NOT SUPPORTED | Not supported | improvement |
| hf-deepseek-v3 | row_58 | Dancers Fred Astaire and Ginger Rogers are represented in th… | Supported | PARTIALLY SUPPORTED | Supported | regression |
| hf-qwen3-32b | row_61 | AJMN receives public funding from the Qatari government, and… | Partially supported | NOT SUPPORTED | Partially supported | regression |
| hf-gpt-oss-20b | row_61 | AJMN receives public funding from the Qatari government, and… | Partially supported | NOT SUPPORTED | Partially supported | regression |
| openrouter-mistral-small-3.2 | row_27 | A few weeks later, the Battle of Aden broke out between the … | Supported | PARTIALLY SUPPORTED | Supported | regression |
| claude-sonnet-4-5 | row_83 | Retired Australian Army Major General Mick Ryan characterize… | Supported | PARTIALLY SUPPORTED | Partially supported | improvement |
| hf-deepseek-v3 | row_65 | Al Jazeera's first day on air was 1 November 1996. It offere… | Supported | PARTIALLY SUPPORTED | Partially supported | improvement |
| hf-qwen3-32b | row_66 | In 2005, the Qatari officials were reportedly so concerned b… | Supported | PARTIALLY SUPPORTED | Supported | regression |
| gemini-2.5-flash | row_88 | Kask died after a short illness on December 30, 2025, at the… | Partially supported | SUPPORTED | Supported | improvement |
| hf-deepseek-v3 | row_66 | In 2005, the Qatari officials were reportedly so concerned b… | Supported | PARTIALLY SUPPORTED | Supported | regression |
| openrouter-qwen-3-32b | row_25 | Following Aden's capture, the secretary-general of the STC a… | Supported | NOT SUPPORTED | Supported | regression |
| hf-qwen3-32b | row_69 | On December 15, 1814, delegates from the five New England st… | Supported | PARTIALLY SUPPORTED | Supported | regression |
| hf-gpt-oss-20b | row_69 | On December 15, 1814, delegates from the five New England st… | Partially supported | NOT SUPPORTED | Supported | lateral |
| gemini-2.5-flash | row_90 | In June, Ajnad al-Sham along with more rebel groups led a ne… | Not supported | PARTIALLY SUPPORTED | Not supported | regression |
| claude-sonnet-4-5 | row_89 | University Radio York (URY) is the oldest independent radio … | Partially supported | NOT SUPPORTED | Partially supported | regression |
| openrouter-mistral-small-3.2 | row_28 | On 7 January, the Saudi-backed forces began advancing toward… | Supported | PARTIALLY SUPPORTED | Supported | regression |
| hf-deepseek-v3 | row_71 | In April 1984, the LTTE formally joined a common militant fr… | Partially supported | SUPPORTED | Partially supported | regression |
| openrouter-gemma-4-26b-a4b | row_25 | Following Aden's capture, the secretary-general of the STC a… | Supported | NOT SUPPORTED | Supported | regression |
| hf-qwen3-32b | row_73 | The rebels proceeded to take the hostages to an unknown hidi… | Supported | PARTIALLY SUPPORTED | Partially supported | improvement |
| gemini-2.5-flash | row_96 | On 6 March 2024, Welch made his senior debut for the club, r… | Not supported | PARTIALLY SUPPORTED | Not supported | regression |
| claude-sonnet-4-5 | row_96 | On 6 March 2024, Welch made his senior debut for the club, r… | Not supported | PARTIALLY SUPPORTED | Not supported | regression |
| openrouter-mistral-small-3.2 | row_30 | PLC forces captured the city's international airport and the… | Supported | PARTIALLY SUPPORTED | Supported | regression |
| hf-qwen3-32b | row_75 | According to various estimates, the number of Chechens who a… | Partially supported | SUPPORTED | Not supported | lateral |
| openrouter-qwen-3-32b | row_27 | A few weeks later, the Battle of Aden broke out between the … | Partially supported | NOT SUPPORTED | Supported | lateral |
| gemini-2.5-flash | row_97 | Shreve's literary works have been featured in The New Yorker… | Partially supported | NOT SUPPORTED | Partially supported | regression |
| gemini-2.5-flash | row_104 | As of December 2024, the company operates six locations: one… | Not supported | PARTIALLY SUPPORTED | Not supported | regression |
| claude-sonnet-4-5 | row_97 | Shreve's literary works have been featured in The New Yorker… | Partially supported | NOT SUPPORTED | Partially supported | regression |
| hf-deepseek-v3 | row_75 | According to various estimates, the number of Chechens who a… | Partially supported | SUPPORTED | Not supported | lateral |
| claude-sonnet-4-5 | row_104 | As of December 2024, the company operates six locations: one… | Not supported | PARTIALLY SUPPORTED | Not supported | regression |
| openrouter-mistral-small-3.2 | row_31 | After Aden's fall to the PLC, Zoubaidi went missing for a br… | Supported | PARTIALLY SUPPORTED | Supported | regression |
| claude-sonnet-4-5 | row_106 | Story of the Eye (French: Histoire de l'œil) is a 1928 novel… | Partially supported | NOT SUPPORTED | Not supported | improvement |
| gemini-2.5-flash | row_112 | Since 2013, she has guest-starred in several episodes of Law… | Not supported | SUPPORTED | Partially supported | lateral |
| openrouter-gemma-4-26b-a4b | row_31 | After Aden's fall to the PLC, Zoubaidi went missing for a br… | Partially supported | NOT SUPPORTED | Supported | lateral |
| gemini-2.5-flash | row_113 | The primary reasons for the decrease in injury when looking … | Partially supported | NOT SUPPORTED | Partially supported | regression |
| claude-sonnet-4-5 | row_113 | The primary reasons for the decrease in injury when looking … | Partially supported | NOT SUPPORTED | Partially supported | regression |
| openrouter-qwen-3-32b | row_31 | After Aden's fall to the PLC, Zoubaidi went missing for a br… | Supported | PARTIALLY SUPPORTED | Supported | regression |
| hf-deepseek-v3 | row_83 | Retired Australian Army Major General Mick Ryan characterize… | Supported | PARTIALLY SUPPORTED | Partially supported | improvement |
| hf-gpt-oss-20b | row_85 | Those who reached Almería were largely rejected by the city’… | Not supported | PARTIALLY SUPPORTED | Partially supported | improvement |
| claude-sonnet-4-5 | row_118 | Adas Israel has played an important role in the nation's cap… | Partially supported | NOT SUPPORTED | Supported | lateral |
| claude-sonnet-4-5 | row_122 | Alexander Muss prioritizes safety for their students and wor… | Supported | PARTIALLY SUPPORTED | Supported | regression |
| claude-sonnet-4-5 | row_119 | At the time, he was a member of the House General Investigat… | Partially supported | SUPPORTED | Supported | improvement |
| openrouter-mistral-small-3.2 | row_33 | The Yemeni government charged Zoubaidi with high treason on … | Supported | NOT SUPPORTED | Supported | regression |
| hf-qwen3-32b | row_88 | Kask died after a short illness on December 30, 2025, at the… | Supported | PARTIALLY SUPPORTED | Supported | regression |
| hf-deepseek-v3 | row_88 | Kask died after a short illness on December 30, 2025, at the… | Partially supported | SUPPORTED | Supported | improvement |
| hf-gpt-oss-20b | row_90 | In June, Ajnad al-Sham along with more rebel groups led a ne… | Not supported | PARTIALLY SUPPORTED | Not supported | regression |
| claude-sonnet-4-5 | row_130 | It defines itself as a home for the growing community of dev… | Supported | NOT SUPPORTED | Supported | regression |
| hf-qwen3-32b | row_93 | The economy of Clinton, along with the surrounding Island Co… | Partially supported | NOT SUPPORTED | Not supported | improvement |
| gemini-2.5-flash | row_136 | Only to make the team feel uneasy and are feeling the strong… | Partially supported | NOT SUPPORTED | Supported | lateral |
| openrouter-gemma-4-26b-a4b | row_33 | The Yemeni government charged Zoubaidi with high treason on … | Partially supported | NOT SUPPORTED | Supported | lateral |
| hf-qwen3-32b | row_96 | On 6 March 2024, Welch made his senior debut for the club, r… | Not supported | PARTIALLY SUPPORTED | Not supported | regression |
| gemini-2.5-flash | row_137 | LaGuardia Airport, United States, 2025 | Supported | PARTIALLY SUPPORTED | Partially supported | improvement |
| hf-qwen3-32b | row_97 | Shreve's literary works have been featured in The New Yorker… | Partially supported | NOT SUPPORTED | Partially supported | regression |
| claude-sonnet-4-5 | row_137 | LaGuardia Airport, United States, 2025 | Supported | PARTIALLY SUPPORTED | Partially supported | improvement |
| hf-deepseek-v3 | row_96 | On 6 March 2024, Welch made his senior debut for the club, r… | Not supported | PARTIALLY SUPPORTED | Not supported | regression |
| claude-sonnet-4-5 | row_132 | Based on polo, two players moved miniature motorbikes around… | Not supported | PARTIALLY SUPPORTED | Supported | lateral |
| hf-gpt-oss-20b | row_97 | Shreve's literary works have been featured in The New Yorker… | Partially supported | NOT SUPPORTED | Partially supported | regression |
| hf-deepseek-v3 | row_97 | Shreve's literary works have been featured in The New Yorker… | Partially supported | NOT SUPPORTED | Partially supported | regression |
| claude-sonnet-4-5 | row_138 | Raul is known to be a strong proponent of Flock Safety ALPR … | Supported | PARTIALLY SUPPORTED | Partially supported | improvement |
| claude-sonnet-4-5 | row_141 | She became a full member of the European Parliament Committe… | Supported | PARTIALLY SUPPORTED | Supported | regression |
| gemini-2.5-flash | row_145 | Thus, the ½ ton Dodge was now called the D100, the ¾ ton D20… | Partially supported | NOT SUPPORTED | Partially supported | regression |
| gemini-2.5-flash | row_149 | Born in Bermuda, Brunson joined Queens Park Rangers in Decem… | Supported | PARTIALLY SUPPORTED | Supported | regression |
| claude-sonnet-4-5 | row_145 | Thus, the ½ ton Dodge was now called the D100, the ¾ ton D20… | Supported | PARTIALLY SUPPORTED | Partially supported | improvement |
| claude-sonnet-4-5 | row_149 | Born in Bermuda, Brunson joined Queens Park Rangers in Decem… | Supported | PARTIALLY SUPPORTED | Supported | regression |
| openrouter-gemma-4-26b-a4b | row_36 | In August, the Houthis began holding mass demonstrations in … | Supported | PARTIALLY SUPPORTED | Supported | regression |
| openrouter-mistral-small-3.2 | row_37 | Fighting broke out between the Houthis and army units in nor… | Supported | PARTIALLY SUPPORTED | Supported | regression |
| gemini-2.5-flash | row_153 | Among her characters were Latina bimbo Melina (Lida and Meli… | Partially supported | NOT SUPPORTED | Partially supported | regression |
| claude-sonnet-4-5 | row_152 | Soundgarden was among one of the first grunge bands to be si… | Supported | PARTIALLY SUPPORTED | Partially supported | improvement |
| hf-deepseek-v3 | row_103 | Varisu and Animal rank among the highest-grossing Indian fil… | Partially supported | NOT SUPPORTED | Not supported | improvement |
| gemini-2.5-flash | row_151 | The team won the North II Group III state sectional champion… | Partially supported | NOT SUPPORTED | Partially supported | regression |
| claude-sonnet-4-5 | row_153 | Among her characters were Latina bimbo Melina (Lida and Meli… | Partially supported | NOT SUPPORTED | Partially supported | regression |
| hf-qwen3-32b | row_104 | As of December 2024, the company operates six locations: one… | Not supported | PARTIALLY SUPPORTED | Not supported | regression |
| hf-gpt-oss-20b | row_104 | As of December 2024, the company operates six locations: one… | Not supported | PARTIALLY SUPPORTED | Not supported | regression |
| hf-deepseek-v3 | row_104 | As of December 2024, the company operates six locations: one… | Not supported | PARTIALLY SUPPORTED | Not supported | regression |
| gemini-2.5-flash | row_157 | During recovery, he would watch Janet Jackson's video anthol… | Partially supported | NOT SUPPORTED | Partially supported | regression |
| claude-sonnet-4-5 | row_154 | The club previously played at Estadio El Vivero in the east … | Partially supported | NOT SUPPORTED | Not supported | improvement |
| openrouter-qwen-3-32b | row_37 | Fighting broke out between the Houthis and army units in nor… | Supported | PARTIALLY SUPPORTED | Supported | regression |
| hf-deepseek-v3 | row_105 | Harris's body was cremated, and his ashes were scattered in … | Not supported | PARTIALLY SUPPORTED | Not supported | regression |
| gemini-2.5-flash | row_155 | COM is well regarded among communication colleges in the Uni… | Partially supported | NOT SUPPORTED | Not supported | improvement |
| claude-sonnet-4-5 | row_151 | The team won the North II Group III state sectional champion… | Partially supported | NOT SUPPORTED | Partially supported | regression |
| gemini-2.5-flash | row_159 | The college is also recognized as a Military Friendly® Schoo… | Not supported | PARTIALLY SUPPORTED | Partially supported | improvement |
| gemini-2.5-flash | row_158 | Its goal is to allow consumers to compare the overall nutrit… | Supported | PARTIALLY SUPPORTED | Partially supported | improvement |
| hf-deepseek-v3 | row_106 | Story of the Eye (French: Histoire de l'œil) is a 1928 novel… | Partially supported | NOT SUPPORTED | Not supported | improvement |
| gemini-2.5-flash | row_163 | Route 22 Confederation/City Centre (this route operates as n… | Supported | PARTIALLY SUPPORTED | Partially supported | improvement |
| claude-sonnet-4-5 | row_159 | The college is also recognized as a Military Friendly® Schoo… | Not supported | PARTIALLY SUPPORTED | Partially supported | improvement |
| gemini-2.5-flash | row_160 | The Ihimba Hot Springs are situated on kabiulil-Katuna Road,… | Partially supported | NOT SUPPORTED | Partially supported | regression |
| claude-sonnet-4-5 | row_161 | From 1968 through 2004, the majority of North Carolina voter… | Not supported | PARTIALLY SUPPORTED | Partially supported | improvement |
| claude-sonnet-4-5 | row_155 | COM is well regarded among communication colleges in the Uni… | Partially supported | NOT SUPPORTED | Not supported | improvement |
| gemini-2.5-flash | row_164 | Some mentionable connections and collaborations from this pe… | Partially supported | NOT SUPPORTED | Not supported | improvement |
| claude-sonnet-4-5 | row_160 | The Ihimba Hot Springs are situated on kabiulil-Katuna Road,… | Not supported | PARTIALLY SUPPORTED | Partially supported | improvement |
| openrouter-mistral-small-3.2 | row_40 | That evening, Benomar announced an agreement that would end … | Supported | NOT SUPPORTED | Supported | regression |
| openrouter-qwen-3-32b | row_39 | More than 60 were killed in clashes on 19 September. | Partially supported | NOT SUPPORTED | Supported | lateral |
| openrouter-gemma-4-26b-a4b | row_34 | The flag of Yemen was raised over government buildings in th… | Partially supported | SUPPORTED | Supported | improvement |
| hf-qwen3-32b | row_113 | The primary reasons for the decrease in injury when looking … | Partially supported | NOT SUPPORTED | Partially supported | regression |
| hf-gpt-oss-20b | row_113 | The primary reasons for the decrease in injury when looking … | Partially supported | NOT SUPPORTED | Partially supported | regression |
| gemini-2.5-flash | row_162 | As of December 2025, OneNote had more than 500M+ downloads o… | Partially supported | SUPPORTED | Not supported | lateral |
| claude-sonnet-4-5 | row_164 | Some mentionable connections and collaborations from this pe… | Partially supported | NOT SUPPORTED | Not supported | improvement |
| hf-qwen3-32b | row_114 | The American Film Institute cites 6 contemporary reviews of … | Supported | NOT SUPPORTED | Supported | regression |
| hf-deepseek-v3 | row_113 | The primary reasons for the decrease in injury when looking … | Partially supported | NOT SUPPORTED | Partially supported | regression |
| claude-sonnet-4-5 | row_167 | Other risk factors for developing adhesive capsulitis includ… | Partially supported | NOT SUPPORTED | Partially supported | regression |
| openrouter-qwen-3-32b | row_40 | That evening, Benomar announced an agreement that would end … | Not supported | PARTIALLY SUPPORTED | Supported | lateral |
| claude-sonnet-4-5 | row_169 | However, it is most often found in open woodlands, along the… | Supported | PARTIALLY SUPPORTED | Partially supported | improvement |
| hf-gpt-oss-20b | row_117 | Rajesh Khanna, Indian actor | Supported | NOT SUPPORTED | Supported | regression |
| claude-sonnet-4-5 | row_172 | If you live in an area with low or moderate flood risk, you … | Supported | PARTIALLY SUPPORTED | Supported | regression |
| gemini-2.5-flash | row_173 | First Nations peoples believe that the berry has many health… | Supported | PARTIALLY SUPPORTED | Partially supported | improvement |
| gemini-2.5-flash | row_174 | Future missions may use radiation-resistant fungi-derived pa… | Partially supported | NOT SUPPORTED | Not supported | improvement |
| hf-gpt-oss-20b | row_118 | Adas Israel has played an important role in the nation's cap… | Supported | NOT SUPPORTED | Supported | regression |
| hf-gpt-oss-20b | row_119 | At the time, he was a member of the House General Investigat… | Supported | PARTIALLY SUPPORTED | Supported | regression |
| hf-qwen3-32b | row_123 | In September 2025, it was confirmed that Adrian Birrell woul… | Supported | PARTIALLY SUPPORTED | Supported | regression |
| gemini-2.5-flash | row_179 | These groups are fighting for gender equailty and continuing… | Partially supported | NOT SUPPORTED | Partially supported | regression |
| hf-gpt-oss-20b | row_123 | In September 2025, it was confirmed that Adrian Birrell woul… | Supported | PARTIALLY SUPPORTED | Supported | regression |
| gemini-2.5-flash | row_182 | Her father (Rameshwar) wanted a son, but despite being a gir… | Not supported | PARTIALLY SUPPORTED | Partially supported | improvement |
| hf-deepseek-v3 | row_123 | In September 2025, it was confirmed that Adrian Birrell woul… | Supported | PARTIALLY SUPPORTED | Supported | regression |
| claude-sonnet-4-5 | row_183 | The following year, qualification was achieved for the FIFA … | Supported | PARTIALLY SUPPORTED | Partially supported | improvement |
| hf-qwen3-32b | row_128 | Republicans should be ashamed of exploiting this tragedy for… | Partially supported | NOT SUPPORTED | Partially supported | regression |
| openrouter-qwen-3-32b | row_41 | By 21 September, the Houthis declared themselves in control … | Partially supported | SUPPORTED | Supported | improvement |
| openrouter-gemma-4-26b-a4b | row_40 | That evening, Benomar announced an agreement that would end … | Not supported | PARTIALLY SUPPORTED | Supported | lateral |
| claude-sonnet-4-5 | row_180 | In 2024, Keoghan publicly announced his relationship with Sa… | Supported | PARTIALLY SUPPORTED | Supported | regression |
| openrouter-mistral-small-3.2 | row_42 | having taken over the offices of the prime minister, the sta… | Supported | PARTIALLY SUPPORTED | Partially supported | improvement |
| gemini-2.5-flash | row_184 | It is managed as part of the Nature Reserve of Orange County… | Partially supported | NOT SUPPORTED | Partially supported | regression |
| claude-sonnet-4-5 | row_186 | Combat Zone Wrestling (CZW) is an American independent profe… | Not supported | PARTIALLY SUPPORTED | Partially supported | improvement |
| hf-deepseek-v3 | row_127 | In May 2025, the New York Times Children’s and Young Adult S… | Not supported | SUPPORTED | Partially supported | lateral |
| claude-sonnet-4-5 | row_188 | The current church building, dating from 1867, had been unde… | Not supported | PARTIALLY SUPPORTED | Not supported | regression |
| hf-qwen3-32b | row_131 | In December 2024, the House of Lords recommended that Lord S… | Supported | PARTIALLY SUPPORTED | Supported | regression |
| hf-deepseek-v3 | row_131 | In December 2024, the House of Lords recommended that Lord S… | Supported | PARTIALLY SUPPORTED | Supported | regression |
| openrouter-mistral-small-3.2 | row_44 | The rebels signed a deal with the government, prompting Prim… | Supported | PARTIALLY SUPPORTED | Supported | regression |
| hf-qwen3-32b | row_133 | In December 2008, Bettencourt stepped down from his role sho… | Supported | PARTIALLY SUPPORTED | Supported | regression |
| hf-deepseek-v3 | row_132 | Based on polo, two players moved miniature motorbikes around… | Supported | NOT SUPPORTED | Supported | regression |
| hf-deepseek-v3 | row_133 | In December 2008, Bettencourt stepped down from his role sho… | Partially supported | SUPPORTED | Supported | improvement |
| hf-qwen3-32b | row_135 | There, she completed her doctoral training and collaborated … | Supported | NOT SUPPORTED | Supported | regression |
| openrouter-gemma-4-26b-a4b | row_44 | The rebels signed a deal with the government, prompting Prim… | Supported | PARTIALLY SUPPORTED | Supported | regression |
| hf-qwen3-32b | row_136 | Only to make the team feel uneasy and are feeling the strong… | Partially supported | NOT SUPPORTED | Supported | lateral |
| hf-gpt-oss-20b | row_137 | LaGuardia Airport, United States, 2025 | Supported | PARTIALLY SUPPORTED | Partially supported | improvement |
| hf-deepseek-v3 | row_135 | There, she completed her doctoral training and collaborated … | Supported | NOT SUPPORTED | Supported | regression |
| openrouter-mistral-small-3.2 | row_45 | However, the group maintained control of key points in the c… | Supported | PARTIALLY SUPPORTED | Supported | regression |
| hf-qwen3-32b | row_138 | Raul is known to be a strong proponent of Flock Safety ALPR … | Supported | PARTIALLY SUPPORTED | Partially supported | improvement |
| hf-deepseek-v3 | row_140 | Thagunna made his Twenty20 International (T20I) debut for Ne… | Partially supported | SUPPORTED | Partially supported | regression |
| openrouter-qwen-3-32b | row_44 | The rebels signed a deal with the government, prompting Prim… | Supported | PARTIALLY SUPPORTED | Supported | regression |
| openrouter-gemma-4-26b-a4b | row_46 | Al Jazeera later claimed to have received taped phone conver… | Supported | PARTIALLY SUPPORTED | Supported | regression |
| hf-deepseek-v3 | row_143 | His comments on Middle Eastern politics have drawn criticism… | Not supported | PARTIALLY SUPPORTED | Not supported | regression |
| hf-deepseek-v3 | row_145 | Thus, the ½ ton Dodge was now called the D100, the ¾ ton D20… | Supported | PARTIALLY SUPPORTED | Partially supported | improvement |
| hf-gpt-oss-20b | row_145 | Thus, the ½ ton Dodge was now called the D100, the ¾ ton D20… | Partially supported | NOT SUPPORTED | Partially supported | regression |
| hf-qwen3-32b | row_149 | Born in Bermuda, Brunson joined Queens Park Rangers in Decem… | Supported | PARTIALLY SUPPORTED | Supported | regression |
| hf-gpt-oss-20b | row_149 | Born in Bermuda, Brunson joined Queens Park Rangers in Decem… | Supported | PARTIALLY SUPPORTED | Supported | regression |
| hf-qwen3-32b | row_153 | Among her characters were Latina bimbo Melina (Lida and Meli… | PARSE_ERROR | NOT SUPPORTED | Partially supported | lateral |
| hf-deepseek-v3 | row_151 | The team won the North II Group III state sectional champion… | Partially supported | NOT SUPPORTED | Partially supported | regression |
| openrouter-mistral-small-3.2 | row_48 | The Houthis continued to apply pressure on the weakened unit… | Supported | PARTIALLY SUPPORTED | Supported | regression |
| hf-deepseek-v3 | row_153 | Among her characters were Latina bimbo Melina (Lida and Meli… | Partially supported | NOT SUPPORTED | Partially supported | regression |
| hf-deepseek-v3 | row_154 | The club previously played at Estadio El Vivero in the east … | Partially supported | NOT SUPPORTED | Not supported | improvement |
| hf-gpt-oss-20b | row_157 | During recovery, he would watch Janet Jackson's video anthol… | Partially supported | NOT SUPPORTED | Partially supported | regression |
| openrouter-qwen-3-32b | row_47 | Saleh's party, the General People's Congress, joined the Hou… | Not supported | PARTIALLY SUPPORTED | Supported | lateral |
| hf-qwen3-32b | row_158 | Its goal is to allow consumers to compare the overall nutrit… | Partially supported | NOT SUPPORTED | Partially supported | regression |
| hf-deepseek-v3 | row_155 | COM is well regarded among communication colleges in the Uni… | Partially supported | NOT SUPPORTED | Not supported | improvement |
| hf-qwen3-32b | row_159 | The college is also recognized as a Military Friendly® Schoo… | Not supported | PARTIALLY SUPPORTED | Partially supported | improvement |
| openrouter-mistral-small-3.2 | row_49 | They stepped up their efforts by shelling Hadi's residence a… | Supported | PARTIALLY SUPPORTED | Partially supported | improvement |
| openrouter-gemma-4-26b-a4b | row_49 | They stepped up their efforts by shelling Hadi's residence a… | Partially supported | NOT SUPPORTED | Partially supported | regression |
| hf-deepseek-v3 | row_159 | The college is also recognized as a Military Friendly® Schoo… | Not supported | PARTIALLY SUPPORTED | Partially supported | improvement |
| hf-gpt-oss-20b | row_160 | The Ihimba Hot Springs are situated on kabiulil-Katuna Road,… | Partially supported | NOT SUPPORTED | Partially supported | regression |
| hf-qwen3-32b | row_160 | The Ihimba Hot Springs are situated on kabiulil-Katuna Road,… | Partially supported | NOT SUPPORTED | Partially supported | regression |
| openrouter-mistral-small-3.2 | row_50 | In the 1930s, Chechnya was flooded with multiple Ukrainians … | Supported | PARTIALLY SUPPORTED | Partially supported | improvement |
| hf-qwen3-32b | row_161 | From 1968 through 2004, the majority of North Carolina voter… | Partially supported | NOT SUPPORTED | Partially supported | regression |
| hf-gpt-oss-20b | row_161 | From 1968 through 2004, the majority of North Carolina voter… | Not supported | PARTIALLY SUPPORTED | Partially supported | improvement |
| hf-qwen3-32b | row_163 | Route 22 Confederation/City Centre (this route operates as n… | Supported | NOT SUPPORTED | Partially supported | lateral |
| hf-gpt-oss-20b | row_163 | Route 22 Confederation/City Centre (this route operates as n… | Supported | PARTIALLY SUPPORTED | Partially supported | improvement |
| hf-qwen3-32b | row_162 | As of December 2025, OneNote had more than 500M+ downloads o… | PARSE_ERROR | NOT SUPPORTED | Not supported | improvement |
| hf-gpt-oss-20b | row_162 | As of December 2025, OneNote had more than 500M+ downloads o… | Partially supported | NOT SUPPORTED | Not supported | improvement |
| hf-deepseek-v3 | row_163 | Route 22 Confederation/City Centre (this route operates as n… | Supported | PARTIALLY SUPPORTED | Partially supported | improvement |
| hf-deepseek-v3 | row_165 | The 1980 NBA Finals was dramatized in the Season 1 of HBO's … | Not supported | PARTIALLY SUPPORTED | Not supported | regression |
| hf-deepseek-v3 | row_164 | Some mentionable connections and collaborations from this pe… | Partially supported | NOT SUPPORTED | Not supported | improvement |
| hf-qwen3-32b | row_167 | Other risk factors for developing adhesive capsulitis includ… | Partially supported | NOT SUPPORTED | Partially supported | regression |
| hf-gpt-oss-20b | row_167 | Other risk factors for developing adhesive capsulitis includ… | Partially supported | NOT SUPPORTED | Partially supported | regression |
| hf-deepseek-v3 | row_167 | Other risk factors for developing adhesive capsulitis includ… | Partially supported | NOT SUPPORTED | Partially supported | regression |
| openrouter-mistral-small-3.2 | row_52 | Aslan Maskhadov tried to concentrate power in his hands to e… | Supported | PARTIALLY SUPPORTED | Partially supported | improvement |
| hf-gpt-oss-20b | row_169 | However, it is most often found in open woodlands, along the… | Partially supported | NOT SUPPORTED | Partially supported | regression |
| hf-qwen3-32b | row_170 | The film was based on a real-life incident of a friend of Ba… | Not supported | PARTIALLY SUPPORTED | Not supported | regression |
| hf-deepseek-v3 | row_169 | However, it is most often found in open woodlands, along the… | Supported | PARTIALLY SUPPORTED | Partially supported | improvement |
| hf-gpt-oss-20b | row_170 | The film was based on a real-life incident of a friend of Ba… | Not supported | PARTIALLY SUPPORTED | Not supported | regression |
| openrouter-qwen-3-32b | row_49 | They stepped up their efforts by shelling Hadi's residence a… | Partially supported | NOT SUPPORTED | Partially supported | regression |
| hf-deepseek-v3 | row_172 | If you live in an area with low or moderate flood risk, you … | Supported | PARTIALLY SUPPORTED | Supported | regression |
| hf-qwen3-32b | row_173 | First Nations peoples believe that the berry has many health… | Supported | NOT SUPPORTED | Partially supported | lateral |
| hf-qwen3-32b | row_174 | Future missions may use radiation-resistant fungi-derived pa… | Supported | NOT SUPPORTED | Not supported | improvement |
| hf-gpt-oss-20b | row_173 | First Nations peoples believe that the berry has many health… | Partially supported | NOT SUPPORTED | Partially supported | regression |
| hf-deepseek-v3 | row_174 | Future missions may use radiation-resistant fungi-derived pa… | Partially supported | NOT SUPPORTED | Not supported | improvement |
| openrouter-qwen-3-32b | row_51 | On 27 August 1958, Major General Stepanov of the Military Av… | Not supported | PARTIALLY SUPPORTED | Supported | lateral |
| openrouter-mistral-small-3.2 | row_55 | Gehry originally called the house Ginger and Fred (after the… | Supported | PARTIALLY SUPPORTED | Supported | regression |
| openrouter-qwen-3-32b | row_55 | Gehry originally called the house Ginger and Fred (after the… | Not supported | PARTIALLY SUPPORTED | Supported | lateral |
| hf-deepseek-v3 | row_178 | This creates a new way for native areas to get extra revenue… | Partially supported | NOT SUPPORTED | Partially supported | regression |
| hf-gpt-oss-20b | row_176 | Previous historical uses of the term “mascarpone” may not ha… | Not supported | PARTIALLY SUPPORTED | Partially supported | improvement |
| hf-deepseek-v3 | row_176 | Previous historical uses of the term “mascarpone” may not ha… | Not supported | SUPPORTED | Partially supported | lateral |
| openrouter-mistral-small-3.2 | row_57 | Gehry himself later discarded his own idea, as he was "afrai… | Supported | PARTIALLY SUPPORTED | Supported | regression |
| openrouter-gemma-4-26b-a4b | row_57 | Gehry himself later discarded his own idea, as he was "afrai… | Supported | PARTIALLY SUPPORTED | Supported | regression |
| hf-qwen3-32b | row_180 | In 2024, Keoghan publicly announced his relationship with Sa… | Supported | PARTIALLY SUPPORTED | Supported | regression |
| hf-deepseek-v3 | row_180 | In 2024, Keoghan publicly announced his relationship with Sa… | Supported | PARTIALLY SUPPORTED | Supported | regression |
| hf-gpt-oss-20b | row_180 | In 2024, Keoghan publicly announced his relationship with Sa… | Partially supported | NOT SUPPORTED | Supported | lateral |
| openrouter-mistral-small-3.2 | row_58 | Dancers Fred Astaire and Ginger Rogers are represented in th… | Supported | PARTIALLY SUPPORTED | Supported | regression |
| hf-qwen3-32b | row_183 | The following year, qualification was achieved for the FIFA … | Supported | PARTIALLY SUPPORTED | Partially supported | improvement |
| hf-gpt-oss-20b | row_184 | It is managed as part of the Nature Reserve of Orange County… | Partially supported | NOT SUPPORTED | Partially supported | regression |
| hf-qwen3-32b | row_184 | It is managed as part of the Nature Reserve of Orange County… | Partially supported | NOT SUPPORTED | Partially supported | regression |
| hf-qwen3-32b | row_186 | Combat Zone Wrestling (CZW) is an American independent profe… | Not supported | PARTIALLY SUPPORTED | Partially supported | improvement |
| hf-gpt-oss-20b | row_186 | Combat Zone Wrestling (CZW) is an American independent profe… | Not supported | PARTIALLY SUPPORTED | Partially supported | improvement |
| hf-deepseek-v3 | row_184 | It is managed as part of the Nature Reserve of Orange County… | Supported | PARTIALLY SUPPORTED | Partially supported | improvement |
| hf-deepseek-v3 | row_186 | Combat Zone Wrestling (CZW) is an American independent profe… | Not supported | PARTIALLY SUPPORTED | Partially supported | improvement |
| openrouter-qwen-3-32b | row_57 | Gehry himself later discarded his own idea, as he was "afrai… | Supported | PARTIALLY SUPPORTED | Supported | regression |
| hf-gpt-oss-20b | row_187 | The summit also called upon Israel to relinquish it's occupa… | Partially supported | NOT SUPPORTED | Partially supported | regression |
| hf-gpt-oss-20b | row_188 | The current church building, dating from 1867, had been unde… | Not supported | PARTIALLY SUPPORTED | Not supported | regression |
| hf-deepseek-v3 | row_188 | The current church building, dating from 1867, had been unde… | Supported | PARTIALLY SUPPORTED | Not supported | lateral |
| openrouter-qwen-3-32b | row_54 | President Maskhadov started a major campaign against hostage… | Supported | PARTIALLY SUPPORTED | Supported | regression |
| openrouter-mistral-small-3.2 | row_65 | Al Jazeera's first day on air was 1 November 1996. It offere… | Supported | PARTIALLY SUPPORTED | Partially supported | improvement |
| openrouter-mistral-small-3.2 | row_66 | In 2005, the Qatari officials were reportedly so concerned b… | Supported | PARTIALLY SUPPORTED | Supported | regression |
| openrouter-gemma-4-26b-a4b | row_66 | In 2005, the Qatari officials were reportedly so concerned b… | Supported | PARTIALLY SUPPORTED | Supported | regression |
| openrouter-qwen-3-32b | row_66 | In 2005, the Qatari officials were reportedly so concerned b… | Supported | PARTIALLY SUPPORTED | Supported | regression |
| openrouter-gemma-4-26b-a4b | row_69 | On December 15, 1814, delegates from the five New England st… | Partially supported | NOT SUPPORTED | Supported | lateral |
| openrouter-mistral-small-3.2 | row_69 | On December 15, 1814, delegates from the five New England st… | Supported | PARTIALLY SUPPORTED | Supported | regression |
| openrouter-qwen-3-32b | row_69 | On December 15, 1814, delegates from the five New England st… | Supported | PARTIALLY SUPPORTED | Supported | regression |
| openrouter-mistral-small-3.2 | row_72 | On 23 July 1992, the Abkhaz faction of Abkhazia's legislativ… | Supported | PARTIALLY SUPPORTED | Partially supported | improvement |
| openrouter-mistral-small-3.2 | row_75 | According to various estimates, the number of Chechens who a… | Partially supported | SUPPORTED | Not supported | lateral |
| openrouter-mistral-small-3.2 | row_76 | In 2002, Rwanda's situation in the war began to worsen. Many… | Partially supported | NOT SUPPORTED | Not supported | improvement |
| openrouter-gemma-4-26b-a4b | row_78 | to Jessica Roesler Gund, and George Gund II. | Not supported | SUPPORTED | Partially supported | lateral |
| openrouter-qwen-3-32b | row_75 | According to various estimates, the number of Chechens who a… | Supported | NOT SUPPORTED | Not supported | improvement |
| openrouter-mistral-small-3.2 | row_83 | Retired Australian Army Major General Mick Ryan characterize… | Supported | NOT SUPPORTED | Partially supported | lateral |
| openrouter-qwen-3-32b | row_83 | Retired Australian Army Major General Mick Ryan characterize… | Supported | PARTIALLY SUPPORTED | Partially supported | improvement |
| openrouter-mistral-small-3.2 | row_84 | Cenat is Catholic. | Partially supported | NOT SUPPORTED | Not supported | improvement |
| openrouter-mistral-small-3.2 | row_86 | Massoud also highlighted the NRF's operational shift to guer… | Partially supported | NOT SUPPORTED | Not supported | improvement |
| openrouter-gemma-4-26b-a4b | row_83 | Retired Australian Army Major General Mick Ryan characterize… | Supported | PARTIALLY SUPPORTED | Partially supported | improvement |
| openrouter-mistral-small-3.2 | row_88 | Kask died after a short illness on December 30, 2025, at the… | Supported | PARTIALLY SUPPORTED | Supported | regression |
| openrouter-qwen-3-32b | row_88 | Kask died after a short illness on December 30, 2025, at the… | Supported | PARTIALLY SUPPORTED | Supported | regression |
| openrouter-qwen-3-32b | row_85 | Those who reached Almería were largely rejected by the city’… | Partially supported | NOT SUPPORTED | Partially supported | regression |
| openrouter-qwen-3-32b | row_90 | In June, Ajnad al-Sham along with more rebel groups led a ne… | Not supported | PARTIALLY SUPPORTED | Not supported | regression |
| openrouter-mistral-small-3.2 | row_93 | The economy of Clinton, along with the surrounding Island Co… | Partially supported | NOT SUPPORTED | Not supported | improvement |
| openrouter-mistral-small-3.2 | row_96 | On 6 March 2024, Welch made his senior debut for the club, r… | Not supported | PARTIALLY SUPPORTED | Not supported | regression |
| openrouter-gemma-4-26b-a4b | row_88 | Kask died after a short illness on December 30, 2025, at the… | Supported | PARTIALLY SUPPORTED | Supported | regression |
| openrouter-gemma-4-26b-a4b | row_96 | On 6 March 2024, Welch made his senior debut for the club, r… | Not supported | PARTIALLY SUPPORTED | Not supported | regression |
| openrouter-mistral-small-3.2 | row_97 | Shreve's literary works have been featured in The New Yorker… | Partially supported | NOT SUPPORTED | Partially supported | regression |
| openrouter-qwen-3-32b | row_96 | On 6 March 2024, Welch made his senior debut for the club, r… | Not supported | PARTIALLY SUPPORTED | Not supported | regression |
| openrouter-mistral-small-3.2 | row_98 | John Zogby was born on September 3, 1948, and grew up in Uti… | Partially supported | NOT SUPPORTED | Not supported | improvement |
| openrouter-qwen-3-32b | row_97 | Shreve's literary works have been featured in The New Yorker… | Partially supported | NOT SUPPORTED | Partially supported | regression |
| openrouter-mistral-small-3.2 | row_102 | and classified among "R1: Doctoral Universities – Very high … | Partially supported | NOT SUPPORTED | Partially supported | regression |
| openrouter-mistral-small-3.2 | row_103 | Varisu and Animal rank among the highest-grossing Indian fil… | Partially supported | NOT SUPPORTED | Not supported | improvement |
| openrouter-gemma-4-26b-a4b | row_104 | As of December 2024, the company operates six locations: one… | Not supported | PARTIALLY SUPPORTED | Not supported | regression |
| openrouter-qwen-3-32b | row_104 | As of December 2024, the company operates six locations: one… | Not supported | PARTIALLY SUPPORTED | Not supported | regression |
| openrouter-gemma-4-26b-a4b | row_105 | Harris's body was cremated, and his ashes were scattered in … | Partially supported | NOT SUPPORTED | Not supported | improvement |
| openrouter-mistral-small-3.2 | row_106 | Story of the Eye (French: Histoire de l'œil) is a 1928 novel… | Partially supported | NOT SUPPORTED | Not supported | improvement |
| openrouter-gemma-4-26b-a4b | row_106 | Story of the Eye (French: Histoire de l'œil) is a 1928 novel… | Partially supported | NOT SUPPORTED | Not supported | improvement |
| openrouter-qwen-3-32b | row_105 | Harris's body was cremated, and his ashes were scattered in … | Not supported | PARTIALLY SUPPORTED | Not supported | regression |
| openrouter-mistral-small-3.2 | row_109 | Olson researched the loss of HMAS Sydney in World War II for… | Partially supported | NOT SUPPORTED | Not supported | improvement |
| openrouter-mistral-small-3.2 | row_111 | Construction of the fence was completed in late 1999 and all… | Partially supported | NOT SUPPORTED | Not supported | improvement |
| openrouter-gemma-4-26b-a4b | row_112 | Since 2013, she has guest-starred in several episodes of Law… | Partially supported | NOT SUPPORTED | Partially supported | regression |
| openrouter-mistral-small-3.2 | row_113 | The primary reasons for the decrease in injury when looking … | Partially supported | NOT SUPPORTED | Partially supported | regression |
| openrouter-mistral-small-3.2 | row_114 | The American Film Institute cites 6 contemporary reviews of … | Partially supported | NOT SUPPORTED | Supported | lateral |
| openrouter-qwen-3-32b | row_113 | The primary reasons for the decrease in injury when looking … | Partially supported | NOT SUPPORTED | Partially supported | regression |
| openrouter-mistral-small-3.2 | row_115 | Later, in December 2025, a Gadsden County jury awarded a $77… | Supported | NOT SUPPORTED | Supported | regression |
| openrouter-qwen-3-32b | row_114 | The American Film Institute cites 6 contemporary reviews of … | Supported | NOT SUPPORTED | Supported | regression |
| openrouter-gemma-4-26b-a4b | row_118 | Adas Israel has played an important role in the nation's cap… | Partially supported | NOT SUPPORTED | Supported | lateral |
| openrouter-qwen-3-32b | row_119 | At the time, he was a member of the House General Investigat… | Supported | PARTIALLY SUPPORTED | Supported | regression |
| openrouter-mistral-small-3.2 | row_123 | In September 2025, it was confirmed that Adrian Birrell woul… | Supported | PARTIALLY SUPPORTED | Supported | regression |
| openrouter-gemma-4-26b-a4b | row_123 | In September 2025, it was confirmed that Adrian Birrell woul… | Supported | PARTIALLY SUPPORTED | Supported | regression |
| openrouter-mistral-small-3.2 | row_127 | In May 2025, the New York Times Children’s and Young Adult S… | Supported | PARTIALLY SUPPORTED | Partially supported | improvement |
| openrouter-mistral-small-3.2 | row_128 | Republicans should be ashamed of exploiting this tragedy for… | Partially supported | NOT SUPPORTED | Partially supported | regression |
| openrouter-mistral-small-3.2 | row_132 | Based on polo, two players moved miniature motorbikes around… | Supported | NOT SUPPORTED | Supported | regression |
| openrouter-mistral-small-3.2 | row_133 | In December 2008, Bettencourt stepped down from his role sho… | Supported | PARTIALLY SUPPORTED | Supported | regression |
| openrouter-qwen-3-32b | row_132 | Based on polo, two players moved miniature motorbikes around… | Partially supported | NOT SUPPORTED | Supported | lateral |
| openrouter-qwen-3-32b | row_133 | In December 2008, Bettencourt stepped down from his role sho… | Supported | PARTIALLY SUPPORTED | Supported | regression |
| openrouter-mistral-small-3.2 | row_135 | There, she completed her doctoral training and collaborated … | Partially supported | SUPPORTED | Supported | improvement |
| openrouter-mistral-small-3.2 | row_137 | LaGuardia Airport, United States, 2025 | Supported | PARTIALLY SUPPORTED | Partially supported | improvement |
| openrouter-qwen-3-32b | row_136 | Only to make the team feel uneasy and are feeling the strong… | Partially supported | NOT SUPPORTED | Supported | lateral |
| openrouter-mistral-small-3.2 | row_138 | Raul is known to be a strong proponent of Flock Safety ALPR … | Supported | PARTIALLY SUPPORTED | Partially supported | improvement |
| openrouter-qwen-3-32b | row_135 | There, she completed her doctoral training and collaborated … | Supported | PARTIALLY SUPPORTED | Supported | regression |
| openrouter-mistral-small-3.2 | row_140 | Thagunna made his Twenty20 International (T20I) debut for Ne… | Supported | PARTIALLY SUPPORTED | Partially supported | improvement |
| openrouter-qwen-3-32b | row_138 | Raul is known to be a strong proponent of Flock Safety ALPR … | Supported | PARTIALLY SUPPORTED | Partially supported | improvement |
| openrouter-qwen-3-32b | row_140 | Thagunna made his Twenty20 International (T20I) debut for Ne… | Supported | PARTIALLY SUPPORTED | Partially supported | improvement |
| openrouter-mistral-small-3.2 | row_143 | His comments on Middle Eastern politics have drawn criticism… | Partially supported | NOT SUPPORTED | Not supported | improvement |
| openrouter-mistral-small-3.2 | row_145 | Thus, the ½ ton Dodge was now called the D100, the ¾ ton D20… | Supported | PARTIALLY SUPPORTED | Partially supported | improvement |
| openrouter-qwen-3-32b | row_145 | Thus, the ½ ton Dodge was now called the D100, the ¾ ton D20… | Supported | PARTIALLY SUPPORTED | Partially supported | improvement |
| openrouter-qwen-3-32b | row_142 | The façade features a double row of arches and, despite modi… | Supported | PARTIALLY SUPPORTED | Supported | regression |
| openrouter-mistral-small-3.2 | row_150 | Introduced in September 2019, it is chambered in 9×19mm Para… | Supported | PARTIALLY SUPPORTED | Partially supported | improvement |
| openrouter-qwen-3-32b | row_149 | Born in Bermuda, Brunson joined Queens Park Rangers in Decem… | Supported | PARTIALLY SUPPORTED | Supported | regression |
| openrouter-mistral-small-3.2 | row_151 | The team won the North II Group III state sectional champion… | Partially supported | NOT SUPPORTED | Partially supported | regression |
| openrouter-gemma-4-26b-a4b | row_151 | The team won the North II Group III state sectional champion… | Partially supported | NOT SUPPORTED | Partially supported | regression |
| openrouter-mistral-small-3.2 | row_152 | Soundgarden was among one of the first grunge bands to be si… | Supported | PARTIALLY SUPPORTED | Partially supported | improvement |
| openrouter-mistral-small-3.2 | row_153 | Among her characters were Latina bimbo Melina (Lida and Meli… | Partially supported | SUPPORTED | Partially supported | regression |
| openrouter-mistral-small-3.2 | row_154 | The club previously played at Estadio El Vivero in the east … | Supported | NOT SUPPORTED | Not supported | improvement |
| openrouter-qwen-3-32b | row_153 | Among her characters were Latina bimbo Melina (Lida and Meli… | Partially supported | NOT SUPPORTED | Partially supported | regression |
| openrouter-qwen-3-32b | row_151 | The team won the North II Group III state sectional champion… | Partially supported | NOT SUPPORTED | Partially supported | regression |
| openrouter-mistral-small-3.2 | row_155 | COM is well regarded among communication colleges in the Uni… | Partially supported | NOT SUPPORTED | Not supported | improvement |
| openrouter-mistral-small-3.2 | row_157 | During recovery, he would watch Janet Jackson's video anthol… | Supported | PARTIALLY SUPPORTED | Partially supported | improvement |
| openrouter-mistral-small-3.2 | row_158 | Its goal is to allow consumers to compare the overall nutrit… | Supported | PARTIALLY SUPPORTED | Partially supported | improvement |
| openrouter-gemma-4-26b-a4b | row_157 | During recovery, he would watch Janet Jackson's video anthol… | Partially supported | NOT SUPPORTED | Partially supported | regression |
| openrouter-mistral-small-3.2 | row_159 | The college is also recognized as a Military Friendly® Schoo… | Not supported | PARTIALLY SUPPORTED | Partially supported | improvement |
| openrouter-qwen-3-32b | row_158 | Its goal is to allow consumers to compare the overall nutrit… | Partially supported | NOT SUPPORTED | Partially supported | regression |
| openrouter-qwen-3-32b | row_159 | The college is also recognized as a Military Friendly® Schoo… | Not supported | PARTIALLY SUPPORTED | Partially supported | improvement |
| openrouter-gemma-4-26b-a4b | row_161 | From 1968 through 2004, the majority of North Carolina voter… | Not supported | PARTIALLY SUPPORTED | Partially supported | improvement |
| openrouter-gemma-4-26b-a4b | row_159 | The college is also recognized as a Military Friendly® Schoo… | Not supported | PARTIALLY SUPPORTED | Partially supported | improvement |
| openrouter-gemma-4-26b-a4b | row_162 | As of December 2025, OneNote had more than 500M+ downloads o… | Supported | NOT SUPPORTED | Not supported | improvement |
| openrouter-mistral-small-3.2 | row_164 | Some mentionable connections and collaborations from this pe… | Partially supported | NOT SUPPORTED | Not supported | improvement |
| openrouter-mistral-small-3.2 | row_165 | The 1980 NBA Finals was dramatized in the Season 1 of HBO's … | Partially supported | NOT SUPPORTED | Not supported | improvement |
| openrouter-qwen-3-32b | row_162 | As of December 2025, OneNote had more than 500M+ downloads o… | Partially supported | NOT SUPPORTED | Not supported | improvement |
| openrouter-qwen-3-32b | row_164 | Some mentionable connections and collaborations from this pe… | Partially supported | NOT SUPPORTED | Not supported | improvement |
| openrouter-mistral-small-3.2 | row_167 | Other risk factors for developing adhesive capsulitis includ… | Partially supported | NOT SUPPORTED | Partially supported | regression |
| openrouter-gemma-4-26b-a4b | row_167 | Other risk factors for developing adhesive capsulitis includ… | Partially supported | NOT SUPPORTED | Partially supported | regression |
| openrouter-mistral-small-3.2 | row_168 | The district encompasses an area of roughly 84 square miles … | Partially supported | NOT SUPPORTED | Partially supported | regression |
| openrouter-qwen-3-32b | row_167 | Other risk factors for developing adhesive capsulitis includ… | Partially supported | NOT SUPPORTED | Partially supported | regression |
| openrouter-mistral-small-3.2 | row_171 | United Records operated during a period of rapid growth in t… | Partially supported | NOT SUPPORTED | Not supported | improvement |
| openrouter-mistral-small-3.2 | row_172 | If you live in an area with low or moderate flood risk, you … | Supported | PARTIALLY SUPPORTED | Supported | regression |
| openrouter-gemma-4-26b-a4b | row_172 | If you live in an area with low or moderate flood risk, you … | Supported | PARTIALLY SUPPORTED | Supported | regression |
| openrouter-mistral-small-3.2 | row_174 | Future missions may use radiation-resistant fungi-derived pa… | Supported | NOT SUPPORTED | Not supported | improvement |
| openrouter-qwen-3-32b | row_174 | Future missions may use radiation-resistant fungi-derived pa… | Partially supported | NOT SUPPORTED | Not supported | improvement |
| openrouter-mistral-small-3.2 | row_176 | Previous historical uses of the term “mascarpone” may not ha… | Supported | NOT SUPPORTED | Partially supported | lateral |
| openrouter-mistral-small-3.2 | row_177 | As of 2025, the Final Fantasy series was won 10 awards at Th… | Partially supported | NOT SUPPORTED | Not supported | improvement |
| openrouter-mistral-small-3.2 | row_178 | This creates a new way for native areas to get extra revenue… | Partially supported | NOT SUPPORTED | Partially supported | regression |
| openrouter-qwen-3-32b | row_176 | Previous historical uses of the term “mascarpone” may not ha… | Supported | NOT SUPPORTED | Partially supported | lateral |
| openrouter-gemma-4-26b-a4b | row_180 | In 2024, Keoghan publicly announced his relationship with Sa… | Supported | NOT SUPPORTED | Supported | regression |
| openrouter-mistral-small-3.2 | row_180 | In 2024, Keoghan publicly announced his relationship with Sa… | Supported | NOT SUPPORTED | Supported | regression |
| openrouter-qwen-3-32b | row_180 | In 2024, Keoghan publicly announced his relationship with Sa… | Supported | PARTIALLY SUPPORTED | Supported | regression |
| openrouter-mistral-small-3.2 | row_182 | Her father (Rameshwar) wanted a son, but despite being a gir… | Supported | PARTIALLY SUPPORTED | Partially supported | improvement |
| openrouter-mistral-small-3.2 | row_183 | The following year, qualification was achieved for the FIFA … | Supported | PARTIALLY SUPPORTED | Partially supported | improvement |
| openrouter-qwen-3-32b | row_183 | The following year, qualification was achieved for the FIFA … | Supported | PARTIALLY SUPPORTED | Partially supported | improvement |
| openrouter-mistral-small-3.2 | row_186 | Combat Zone Wrestling (CZW) is an American independent profe… | Not supported | PARTIALLY SUPPORTED | Partially supported | improvement |
| openrouter-gemma-4-26b-a4b | row_184 | It is managed as part of the Nature Reserve of Orange County… | Not supported | PARTIALLY SUPPORTED | Partially supported | improvement |
| openrouter-qwen-3-32b | row_186 | Combat Zone Wrestling (CZW) is an American independent profe… | Not supported | PARTIALLY SUPPORTED | Partially supported | improvement |
| openrouter-gemma-4-26b-a4b | row_187 | The summit also called upon Israel to relinquish it's occupa… | Partially supported | SUPPORTED | Partially supported | regression |
| openrouter-qwen-3-32b | row_188 | The current church building, dating from 1867, had been unde… | Not supported | PARTIALLY SUPPORTED | Not supported | regression |
| openrouter-granite-4.1-8b | row_4 | In March 2025, the Federation for American Immigration Refor… | Supported | PARTIALLY SUPPORTED | Supported | regression |
| openrouter-granite-4.1-8b | row_6 | According to the 2016 Yearbook of Immigration Statistics, th… | Supported | PARTIALLY SUPPORTED | Supported | regression |
| openrouter-granite-4.1-8b | row_2 | Immigration has been a major source of population growth and… | Supported | PARTIALLY SUPPORTED | Supported | regression |
| openrouter-granite-4.1-8b | row_9 | of these ethnic quotas with per-country limits for family-sp… | Supported | PARTIALLY SUPPORTED | Supported | regression |
| openrouter-granite-4.1-8b | row_12 | The United States led the world in refugee resettlement for … | Supported | PARTIALLY SUPPORTED | Supported | regression |
| openrouter-granite-4.1-8b | row_11 | In 2017, out of the U.S. foreign-born population, some 45% (… | Supported | PARTIALLY SUPPORTED | Partially supported | improvement |
| openrouter-granite-4.1-8b | row_25 | Following Aden's capture, the secretary-general of the STC a… | Supported | PARTIALLY SUPPORTED | Supported | regression |
| openrouter-granite-4.1-8b | row_30 | PLC forces captured the city's international airport and the… | Supported | PARTIALLY SUPPORTED | Supported | regression |
| openrouter-granite-4.1-8b | row_40 | That evening, Benomar announced an agreement that would end … | Supported | PARTIALLY SUPPORTED | Supported | regression |
| openrouter-granite-4.1-8b | row_39 | More than 60 were killed in clashes on 19 September. | Partially supported | SUPPORTED | Supported | improvement |
| openrouter-granite-4.1-8b | row_33 | The Yemeni government charged Zoubaidi with high treason on … | Supported | NOT SUPPORTED | Supported | regression |
| openrouter-granite-4.1-8b | row_34 | The flag of Yemen was raised over government buildings in th… | Supported | NOT SUPPORTED | Supported | regression |
| openrouter-granite-4.1-8b | row_45 | However, the group maintained control of key points in the c… | Supported | PARTIALLY SUPPORTED | Supported | regression |
| openrouter-granite-4.1-8b | row_44 | The rebels signed a deal with the government, prompting Prim… | Supported | PARTIALLY SUPPORTED | Supported | regression |
| openrouter-granite-4.1-8b | row_41 | By 21 September, the Houthis declared themselves in control … | Partially supported | NOT SUPPORTED | Supported | lateral |
| openrouter-granite-4.1-8b | row_51 | On 27 August 1958, Major General Stepanov of the Military Av… | Partially supported | NOT SUPPORTED | Supported | lateral |
| openrouter-granite-4.1-8b | row_57 | Gehry himself later discarded his own idea, as he was "afrai… | Supported | PARTIALLY SUPPORTED | Supported | regression |
| openrouter-granite-4.1-8b | row_59 | In 2016, over the course of five months, two floors of the b… | Supported | PARTIALLY SUPPORTED | Supported | regression |
| openrouter-granite-4.1-8b | row_58 | Dancers Fred Astaire and Ginger Rogers are represented in th… | Supported | PARTIALLY SUPPORTED | Supported | regression |
| openrouter-granite-4.1-8b | row_65 | Al Jazeera's first day on air was 1 November 1996. It offere… | Supported | PARTIALLY SUPPORTED | Partially supported | improvement |
| openrouter-granite-4.1-8b | row_68 | The original settlement area contained the site of the Chart… | Supported | PARTIALLY SUPPORTED | Partially supported | improvement |
| openrouter-granite-4.1-8b | row_71 | In April 1984, the LTTE formally joined a common militant fr… | Supported | NOT SUPPORTED | Partially supported | lateral |
| openrouter-granite-4.1-8b | row_69 | On December 15, 1814, delegates from the five New England st… | Supported | PARTIALLY SUPPORTED | Supported | regression |
| openrouter-granite-4.1-8b | row_76 | In 2002, Rwanda's situation in the war began to worsen. Many… | Partially supported | NOT SUPPORTED | Not supported | improvement |
| openrouter-granite-4.1-8b | row_83 | Retired Australian Army Major General Mick Ryan characterize… | Not supported | PARTIALLY SUPPORTED | Partially supported | improvement |
| openrouter-granite-4.1-8b | row_90 | In June, Ajnad al-Sham along with more rebel groups led a ne… | Partially supported | NOT SUPPORTED | Not supported | improvement |
| openrouter-granite-4.1-8b | row_100 | and the Minister of Interior in the Syrian transitional gove… | Supported | PARTIALLY SUPPORTED | Not supported | lateral |
| openrouter-granite-4.1-8b | row_105 | Harris's body was cremated, and his ashes were scattered in … | Not supported | PARTIALLY SUPPORTED | Not supported | regression |
| openrouter-granite-4.1-8b | row_112 | Since 2013, she has guest-starred in several episodes of Law… | Supported | NOT SUPPORTED | Partially supported | lateral |
| openrouter-granite-4.1-8b | row_115 | Later, in December 2025, a Gadsden County jury awarded a $77… | Supported | NOT SUPPORTED | Supported | regression |
| openrouter-granite-4.1-8b | row_122 | Alexander Muss prioritizes safety for their students and wor… | Supported | PARTIALLY SUPPORTED | Supported | regression |
| openrouter-granite-4.1-8b | row_123 | In September 2025, it was confirmed that Adrian Birrell woul… | Supported | PARTIALLY SUPPORTED | Supported | regression |
| openrouter-granite-4.1-8b | row_127 | In May 2025, the New York Times Children’s and Young Adult S… | Not supported | PARTIALLY SUPPORTED | Partially supported | improvement |
| openrouter-granite-4.1-8b | row_131 | In December 2024, the House of Lords recommended that Lord S… | Supported | PARTIALLY SUPPORTED | Supported | regression |
| openrouter-granite-4.1-8b | row_132 | Based on polo, two players moved miniature motorbikes around… | Partially supported | NOT SUPPORTED | Supported | lateral |
| openrouter-granite-4.1-8b | row_135 | There, she completed her doctoral training and collaborated … | Supported | PARTIALLY SUPPORTED | Supported | regression |
| openrouter-granite-4.1-8b | row_128 | Republicans should be ashamed of exploiting this tragedy for… | Partially supported | SUPPORTED | Partially supported | regression |
| openrouter-granite-4.1-8b | row_137 | LaGuardia Airport, United States, 2025 | Supported | PARTIALLY SUPPORTED | Partially supported | improvement |
| openrouter-granite-4.1-8b | row_136 | Only to make the team feel uneasy and are feeling the strong… | Not supported | PARTIALLY SUPPORTED | Supported | lateral |
| openrouter-granite-4.1-8b | row_138 | Raul is known to be a strong proponent of Flock Safety ALPR … | Supported | NOT SUPPORTED | Partially supported | lateral |
| openrouter-granite-4.1-8b | row_140 | Thagunna made his Twenty20 International (T20I) debut for Ne… | Supported | PARTIALLY SUPPORTED | Partially supported | improvement |
| openrouter-granite-4.1-8b | row_149 | Born in Bermuda, Brunson joined Queens Park Rangers in Decem… | Supported | PARTIALLY SUPPORTED | Supported | regression |
| openrouter-granite-4.1-8b | row_153 | Among her characters were Latina bimbo Melina (Lida and Meli… | Partially supported | SUPPORTED | Partially supported | regression |
| openrouter-granite-4.1-8b | row_158 | Its goal is to allow consumers to compare the overall nutrit… | Supported | PARTIALLY SUPPORTED | Partially supported | improvement |
| openrouter-granite-4.1-8b | row_155 | COM is well regarded among communication colleges in the Uni… | Partially supported | NOT SUPPORTED | Not supported | improvement |
| openrouter-granite-4.1-8b | row_157 | During recovery, he would watch Janet Jackson's video anthol… | Supported | PARTIALLY SUPPORTED | Partially supported | improvement |
| openrouter-granite-4.1-8b | row_161 | From 1968 through 2004, the majority of North Carolina voter… | Not supported | PARTIALLY SUPPORTED | Partially supported | improvement |
| openrouter-granite-4.1-8b | row_159 | The college is also recognized as a Military Friendly® Schoo… | Not supported | PARTIALLY SUPPORTED | Partially supported | improvement |
| openrouter-granite-4.1-8b | row_163 | Route 22 Confederation/City Centre (this route operates as n… | Not supported | SUPPORTED | Partially supported | lateral |
| openrouter-granite-4.1-8b | row_164 | Some mentionable connections and collaborations from this pe… | Not supported | PARTIALLY SUPPORTED | Not supported | regression |
| openrouter-granite-4.1-8b | row_167 | Other risk factors for developing adhesive capsulitis includ… | Partially supported | NOT SUPPORTED | Partially supported | regression |
| openrouter-granite-4.1-8b | row_171 | United Records operated during a period of rapid growth in t… | Partially supported | NOT SUPPORTED | Not supported | improvement |
| openrouter-granite-4.1-8b | row_173 | First Nations peoples believe that the berry has many health… | Supported | NOT SUPPORTED | Partially supported | lateral |
| openrouter-granite-4.1-8b | row_170 | The film was based on a real-life incident of a friend of Ba… | Partially supported | NOT SUPPORTED | Not supported | improvement |
| openrouter-granite-4.1-8b | row_176 | Previous historical uses of the term “mascarpone” may not ha… | Supported | NOT SUPPORTED | Partially supported | lateral |
| openrouter-granite-4.1-8b | row_180 | In 2024, Keoghan publicly announced his relationship with Sa… | Supported | PARTIALLY SUPPORTED | Supported | regression |
| openrouter-granite-4.1-8b | row_181 | Berguer was born in 1940 in A Coruña, Spain. | Supported | PARTIALLY SUPPORTED | Supported | regression |
| openrouter-granite-4.1-8b | row_182 | Her father (Rameshwar) wanted a son, but despite being a gir… | Partially supported | NOT SUPPORTED | Partially supported | regression |
| openrouter-granite-4.1-8b | row_184 | It is managed as part of the Nature Reserve of Orange County… | Supported | PARTIALLY SUPPORTED | Partially supported | improvement |
| openrouter-granite-4.1-8b | row_183 | The following year, qualification was achieved for the FIFA … | Supported | PARTIALLY SUPPORTED | Partially supported | improvement |
| openrouter-granite-4.1-8b | row_179 | These groups are fighting for gender equailty and continuing… | Supported | PARTIALLY SUPPORTED | Partially supported | improvement |
| openrouter-granite-4.1-8b | row_187 | The summit also called upon Israel to relinquish it's occupa… | Supported | NOT SUPPORTED | Partially supported | lateral |
