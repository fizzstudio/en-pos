
import * as inflectors from "@fizz/en-inflectors";
import * as lexicon from "@fizz/en-lexicon";

import {conditions as brillConditions} from "./smoothing/brill_conditions";
import {rules as brillRules} from "./smoothing/brill_rules";
import ingExceptions from "./smoothing/ing_exceptions";
import itCities from "./tagging/cities";
import itComplexWords from "./tagging/complex_words";
import itContractions from "./tagging/contractions";
import itGivenNames from "./tagging/given_names";
import itLexiconLookup from "./tagging/lexicon";
import itMeta from "./tagging/meta";
import itNonLetters from "./tagging/non_letters";
import itPotentialProper from "./tagging/potential_proper";
import itPrefixes from "./tagging/prefixes";
import itRepetitive from "./tagging/repetitive";
import itSlang from "./tagging/slang";
import itSuffixes from "./tagging/suffixes";

// smoothing rules and conditions




// Meta object provided by the lexer
export interface MetaObject {
	pos?:any;
	tag?:any;
	yearlyRange?:any;
	time?:any;
	ratio?:any;
	timeIndicator?:any;
	order?:any;
	hyphenedOrder?:any;
	number?:any;
	abbrev?:any;
	properNoun?:any;
	acronym?:any;
	meta?:any;
}

export interface Result {
	tokens:Array<string>;
	tags:Array<string>;
	confidence:Array<number>;
	smooth:()=>Result;
	initial:()=>Result;
}

class Tag {



	public tokens:		Array<string> 		= [];
	public tags:		Array<string> 		= [];
	public confidence:	Array<number> 		= [];
	public meta:		Array<MetaObject>	= [];
	public blocked:		Array<boolean> 		= [];



	constructor(tokens:Array<string>,meta?:Array<MetaObject>){
		this.tokens = tokens;
		this.meta = meta || [];

		// defaults
		tokens.forEach((x,i)=>{
			this.blocked[i] = false;
			this.confidence[i] = 0;
			if(!this.meta[i]) this.meta[i] = {};
		});

		return this;
	}



	public initial = function():Result{
		for(let i = 0; i < this.tokens.length; i++) {
			let token = this.tokens[i];
			let meta = this.meta[i];

			// dictionary stage
			let nonLetter = itNonLetters(token);
			if(nonLetter) {
				this.tags[i] = nonLetter;
				this.confidence[i] = 1;
				this.blocked[i] = true;
				continue;
			}

			let lexiconSensitive = itLexiconLookup(token,true);
			if(lexiconSensitive) {
				this.tags[i] = lexiconSensitive;
				this.confidence[i] = 1;
				this.blocked[i] = false;
				continue;
			}

			let contraction = itContractions(token);
			if(contraction) {
				this.tags[i] = contraction;
				this.confidence[i] = 1;
				this.blocked[i] = true;
				continue;
			}

			let givenNameSensitive = itGivenNames(token,true);
			if(givenNameSensitive) {
				this.tags[i] = givenNameSensitive;
				this.confidence[i] = 0.9;
				this.blocked[i] = true;
				continue;
			}
			
			let citiesSensitive = itCities(token,true);
			if(citiesSensitive) {
				this.tags[i] = citiesSensitive;
				this.confidence[i] = 0.9;
				this.blocked[i] = true;
				continue;
			}
			

			// Semi dictionary stage
			let lexiconInsensitive = itLexiconLookup(token);
			if(lexiconInsensitive) {
				this.tags[i] = lexiconInsensitive;
				this.confidence[i] = 0.8;
				this.blocked[i] = false;
				continue;
			}

			let givenNameInsensitive = itGivenNames(token);
			if(givenNameInsensitive) {
				this.tags[i] = givenNameInsensitive;
				this.confidence[i] = 0.8;
				this.blocked[i] = true;
				continue;
			}

			let citiesInsensitive = itCities(token);
			if(citiesInsensitive) {
				this.tags[i] = citiesInsensitive;
				this.confidence[i] = 0.8;
				this.blocked[i] = true;
				continue;
			}

			// Meta stage
			let metaBasedResolution = itMeta(meta);
			if(metaBasedResolution) {
				this.tags[i] = metaBasedResolution;
				this.confidence[i] = 0.6;
				this.blocked[i] = false;
				continue;
			}

			let complexWordsResolution = itComplexWords(token);
			if(complexWordsResolution) {
				this.tags[i] = complexWordsResolution;
				this.confidence[i] = 0.5;
				this.blocked[i] = false;
				continue;
			}

			let prefixBasedResolution = itPrefixes(token);
			if(prefixBasedResolution) {
				this.tags[i] = prefixBasedResolution;
				this.confidence[i] = 0.5;
				this.blocked[i] = false;
				continue;
			}

			let suffixBasedResolution = itSuffixes(token);
			if(suffixBasedResolution) {
				this.tags[i] = suffixBasedResolution;
				this.confidence[i] = 0.5;
				this.blocked[i] = false;
				continue;
			}

			// Irregular stage
			let repetitionResolution = itRepetitive(token);
			if(repetitionResolution) {
				this.tags[i] = repetitionResolution;
				this.confidence[i] = 0.5;
				this.blocked[i] = false;
				continue;
			}

			let slangResolution = itSlang(token);
			if(slangResolution) {
				this.tags[i] = slangResolution;
				this.confidence[i] = 0.5;
				this.blocked[i] = false;
				continue;
			};


			let potentialProperResolution = itPotentialProper(token);
			if(potentialProperResolution) {
				this.tags[i] = potentialProperResolution;
				this.confidence[i] = 0.5;
				this.blocked[i] = false;
				continue;
			}

			// defaulting
			if(new inflectors.Inflectors(token).isPlural()) {
				this.tags[i] = "NNS";
				this.confidence[i] = 0;
				this.blocked[i] = false;
				continue;
			}
			this.tags[i] = "NN";
		}
		return this;
	};



	public smooth = function():Result{
		this._PreBrill();
		this._Brill();
		this._PostBrill();
		return this;
	};



	private _PreBrill = function(){
		for (let i = 0; i < this.tags.length; i++) {
			if(this.blocked[i]) continue;
			let tag = this.tags[i];
			let token = this.tokens[i].toLowerCase();
			let prev1Tag = this.tags[i-1] || "";
			let prev2Tag = this.tags[i-2] || "";
			let prev3Tag = this.tags[i-3] || "";
			let prev4Tag = this.tags[i-4] || "";
			let next1Tag = this.tags[i+1] || "";
			let prev1Token = (this.tokens[i-1] || "").toLowerCase();

			if(/^('?)\d+(-|\/|:)?(\d+)?$/.test(token)) {
				this.tags[i] = "CD";
				this.blocked[i] = true;
				this.confidence[i] = 1;
				continue;
			}

			if(~["hundred","thousands"].indexOf(token) || /^(m|b|tri|quadr|quint|sext|sept|oct|non|dec|undec|duodec|tredec|quattuordec|quindec|sexdec|sedec|septendec)illions$/.test(token)){
				this.tags[i] = "NNS";
				this.blocked[i] = true;
				this.confidence[i] = 1;
				continue;
			}

			if((!prev1Tag)&&token==="that") {
				this.tags[i] = "DT";
				this.blocked[i] = true;
				this.confidence[i] = 1;
				continue;
			}

			if(prev1Tag === "TO" && (inflectors.infinitives[token])) {
				this.tags[i] = "VB";
				this.blocked[i] = true;
				this.confidence[i] = 1;
				continue;
			}

			if(tag === "NN" && (!lexicon.lexicon[token]) && new inflectors.Inflectors(token).isPlural()) {
				this.tags[i] = "NNS";
				continue;
			}

			if(tag === "JJ" && next1Tag === "DT" && ~(lexicon.lexicon[token]||"").indexOf("VB")) {
				this.tags[i] = lexicon.lexicon[token].split("|").find((x:string)=>x.indexOf("V") === 0);
				continue;
			}

			if(tag === "VBD" && ~["PRP","WP","IN","JJR"].indexOf(prev1Tag) && ~(lexicon.lexicon[token]||"").indexOf("VBN")) {
				if(
					(prev1Tag === "PRP" && prev2Tag === "WP" && prev3Tag === "IN" && prev4Tag === "JJR") ||
					(prev1Tag === "WP" && prev2Tag === "IN" && prev3Tag === "JJR") ||
					(prev1Tag === "IN" && prev2Tag === "JJR") ||
					(prev1Tag === "JJR")
				){
					this.tags[i] = "VBN";
					continue;
				}
			}

			if(token.length > 3 && (!lexicon.lexicon[token]) && prev1Tag && (!~token.indexOf("-")) && (!/^[A-Z][a-z]+/g.test(this.tokens[i])) && /[^e]ed$/.test(token)){
				this.tags[i] = "VBN";
				continue;
			}
			
			if 	(token.length > 4 &&
				(!~["NNP","NNPS","VBG"].indexOf(tag)) &&
				(!~["VBG","DT","JJ","NN"].indexOf(prev1Tag)) &&
				((!prev1Tag) || !/^[A-Z][a-z]+/g.test(this.tokens[i])) &&
				(!~ingExceptions.indexOf(token)) && (!lexicon.lexicon[token]) &&
				~(lexicon.lexicon[token]||"").indexOf("VBG")
			) {
				this.tags[i] = "VBG";
				continue;
			}
			
			if 	(token.length > 4 && token.endsWith('in') && tag === 'NN' &&
				((!prev1Tag) || !/^[A-Z][a-z]+/g.test(token)) &&
				(prev1Tag !== 'NN' && prev1Tag !== 'JJ' && prev1Tag !== 'DT' && prev1Tag !== 'VBG') &&
				(~(lexicon.lexicon[token+"g"]||"").indexOf("VBG"))
			) {
				this.tags[i] = "VBG";
				continue;
			}

			if(~(lexicon.lexicon[token]||"").indexOf("PDT") && next1Tag === "DT") {
				this.tags[i] = "PDT";
				continue;
			}

			if(((!prev1Token) || prev1Token === "\"" || prev1Token === "said" || prev1Tag.startsWith("W")) && token === "that" && tag === "IN" && next1Tag === "MD") {
				this.tags[i] = "DT";
				continue;
			}

		}
	};



	private _applyBrillRule = function(index:number,iteration:number){
		for (var i = 0; i < brillRules.length; i++) {
			let rule = brillRules[i];
			if(rule.from !== this.tags[index] || (rule.secondRun && iteration === 1)) continue;
			let type = rule.type;
			let tmp,tmp2;
			let token = this.tokens[index];
			let tag = this.tags[index];

			// Start word rule is case sensitive
			if (type === brillConditions.STARTWORD) {
				if(index === 0 && token === rule.c1 && ((!rule.verify)||((!lexicon.lexicon[token])||~lexicon.lexicon[token].split("|").indexOf(rule.to)))) this.tags[index] = rule.to;
				continue;
			}

			token = (token||"").toLowerCase();

			if (type === brillConditions.PREV2WORDS) {
				tmp = this.tokens[index - 1] || "";
				tmp2 = this.tokens[index - 2] || "";
				if(tmp === rule.c1 && tmp2 === rule.c2 && ((!rule.verify)||((!lexicon.lexicon[token])||~lexicon.lexicon[token].split("|").indexOf(rule.to)))) this.tags[index] = rule.to;
				continue;
			}

			else if (type === brillConditions.PREVTAG) {
				if (index && this.tags[index - 1] === rule.c1 && ((!rule.verify)||((!lexicon.lexicon[token])||~lexicon.lexicon[token].split("|").indexOf(rule.to)))) this.tags[index] = rule.to;
				continue;
			}

			else if (type === brillConditions.PREVWORDPREVTAG) {
				tmp = this.tokens[index - 1] || '';
				if (this.tags[index - 1] === rule.c2 && tmp.toLowerCase() === rule.c1 && ((!rule.verify)||((!lexicon.lexicon[token])||~lexicon.lexicon[token].split("|").indexOf(rule.to)))) this.tags[index] = rule.to;
				continue;
			}
			
			else if (type === brillConditions.NEXTTAG) {
				if (this.tags[index + 1] === rule.c1 && ((!rule.verify)||((!lexicon.lexicon[token])||~lexicon.lexicon[token].split("|").indexOf(rule.to)))) this.tags[index] = rule.to;
				continue;
			}
			
			else if (type === brillConditions.NEXTTAG2) {
				if (this.tags[index + 2] === rule.c1 && ((!rule.verify)||((!lexicon.lexicon[token])||~lexicon.lexicon[token].split("|").indexOf(rule.to)))) this.tags[index] = rule.to;
				continue;
			}
			
			else if (type === brillConditions.PREVTAG2) {
				if (this.tags[index - 2] === rule.c1 && ((!rule.verify)||((!lexicon.lexicon[token])||~lexicon.lexicon[token].split("|").indexOf(rule.to)))) this.tags[index] = rule.to;
				continue;
			}
			
			else if (type === brillConditions.PREV1OR2TAG) {
				if (this.tags[index - 1] === rule.c1 || this.tags[index - 2] === rule.c1 && ((!rule.verify)||((!lexicon.lexicon[token])||~lexicon.lexicon[token].split("|").indexOf(rule.to)))) this.tags[index] = rule.to;
				continue;
			}
			
			else if (type === brillConditions.PREVWORD) {
				tmp = this.tokens[index - 1] || '';
				if (tmp.toLowerCase() === rule.c1 && ((!rule.verify)||((!lexicon.lexicon[token])||~lexicon.lexicon[token].split("|").indexOf(rule.to)))) this.tags[index] = rule.to;
				continue;
			}
			
			else if (type === brillConditions.CURRENTWD) {
				if (this.token === rule.c1 && ((!rule.verify)||((!lexicon.lexicon[token])||~lexicon.lexicon[token].split("|").indexOf(rule.to)))) this.tags[index] = rule.to;
				continue;
			}

			else if (type === brillConditions.CURRENTWDRGX) {
				if (rule.cr?.test(token) && ((!rule.verify)||((!lexicon.lexicon[token])||~lexicon.lexicon[token].split("|").indexOf(rule.to)))) this.tags[index] = rule.to;
				continue;
			}
			
			else if (type === brillConditions.WDPREVTAG) {
				if (token === rule.c2 && this.tags[index - 1] === rule.c1 && ((!rule.verify)||((!lexicon.lexicon[token])||~lexicon.lexicon[token].split("|").indexOf(rule.to)))) this.tags[index] = rule.to;
				continue;
			}
			
			else if (type === brillConditions.WDPREVWD) {
				tmp = this.tokens[index - 1] || '';
				if (this.token === rule.c2 && tmp.toLowerCase() === rule.c1 && ((!rule.verify)||((!lexicon.lexicon[token])||~lexicon.lexicon[token].split("|").indexOf(rule.to)))) this.tags[index] = rule.to;
				continue;
			}
			
			else if (type === brillConditions.NEXT1OR2OR3TAG) {
				if (this.tags[index + 1] === rule.c1 || this.tags[index + 2] === rule.c1 || this.tags[index + 3] === rule.c1 && ((!rule.verify)||((!lexicon.lexicon[token])||~lexicon.lexicon[token].split("|").indexOf(rule.to)))) this.tags[index] = rule.to;
				continue;
			}
			
			else if (type === brillConditions.NEXT2WD) {
				tmp = this.tokens[index + 2] || '';
				if (tmp.toLowerCase() === rule.c1 && ((!rule.verify)||((!lexicon.lexicon[token])||~lexicon.lexicon[token].split("|").indexOf(rule.to)))) this.tags[index] = rule.to;
				continue;
			}
			
			else if (type === brillConditions.WDNEXTWD) {
				tmp = this.tokens[index + 1] || '';
				if (token === rule.c1 && tmp.toLowerCase() === rule.c2 && ((!rule.verify)||((!lexicon.lexicon[token])||~lexicon.lexicon[token].split("|").indexOf(rule.to)))) this.tags[index] = rule.to;
				continue;
			}
			
			else if (type === brillConditions.WDNEXTTAG) {
				if (token === rule.c1 && this.tags[index + 1] === rule.c2 && ((!rule.verify)||((!lexicon.lexicon[token])||~lexicon.lexicon[token].split("|").indexOf(rule.to)))) this.tags[index] = rule.to;
				continue;
			}
			
			else if (type === brillConditions.PREV1OR2OR3TAG) {
				if (this.tags[index - 1] === rule.c1 || this.tags[index - 2] === rule.c1 || this.tags[index - 3] === rule.c1 && ((!rule.verify)||((!lexicon.lexicon[token])||~lexicon.lexicon[token].split("|").indexOf(rule.to)))) this.tags[index] = rule.to;
				continue;
			}
			
			else if (type === brillConditions.SURROUNDTAG) {
				if (this.tags[index - 1] === rule.c1 && this.tags[index + 1] === rule.c2 && ((!rule.verify)||((!lexicon.lexicon[token])||~lexicon.lexicon[token].split("|").indexOf(rule.to)))) this.tags[index] = rule.to;
				continue;
			}
			
			else if (type === brillConditions.SURROUNDTAGWD) {
				if (token === rule.c1 && this.tags[index - 1] === rule.c2 && this.tags[index + 1] === rule.c3 && ((!rule.verify)||((!lexicon.lexicon[token])||~lexicon.lexicon[token].split("|").indexOf(rule.to)))) this.tags[index] = rule.to;
				continue;
			}
			
			else if (type === brillConditions.NEXTWD) {
				tmp = this.tokens[index + 1] || '';
				if (tmp.toLowerCase() === rule.c1 && ((!rule.verify)||((!lexicon.lexicon[token])||~lexicon.lexicon[token].split("|").indexOf(rule.to)))) this.tags[index] = rule.to;
				continue;
			}
			
			else if (type === brillConditions.NEXT1OR2TAG) {
				if (this.tags[index + 1] === rule.c1 || this.tags[index + 2] === rule.c1 && ((!rule.verify)||((!lexicon.lexicon[token])||~lexicon.lexicon[token].split("|").indexOf(rule.to)))) this.tags[index] = rule.to;
				continue;
			}
			
			else if (type === brillConditions.PREV2TAG) {
				if (this.tags[index - 2] === rule.c1 && this.tags[index - 1] === rule.c2 && ((!rule.verify)||((!lexicon.lexicon[token])||~lexicon.lexicon[token].split("|").indexOf(rule.to)))) this.tags[index] = rule.to;
				continue;
			}
			
			else if (type === brillConditions.PREV2TAGNEXTTAG) {
				if (this.tags[index - 2] === rule.c1 && this.tags[index - 1] === rule.c2 && this.tags[index + 1] === rule.c3 && ((!rule.verify)||((!lexicon.lexicon[token])||~lexicon.lexicon[token].split("|").indexOf(rule.to)))) this.tags[index] = rule.to;
				continue;
			}
			
			else if (type === brillConditions.NEXT2TAG) {
				if (this.tags[index + 1] === rule.c1 && this.tags[index + 2] === rule.c2) this.tags[index] = rule.to;
				continue;
			}
			
			else if (type === brillConditions.NEXT1OR2WD) {
				tmp = this.tokens[index + 1] || '';
				tmp2 = this.tokens[index + 2] || '';
				if (tmp.toLowerCase() === rule.c1 || tmp2.toLowerCase() === rule.c1 && ((!rule.verify)||((!lexicon.lexicon[token])||~lexicon.lexicon[token].split("|").indexOf(rule.to)))) this.tags[index] = rule.to;
				continue;
			}
			
			else if (type === brillConditions.PREV2WD) {
				tmp2 = this.tokens[index - 2] || '';
				if (tmp2.toLowerCase() === rule.c1 && ((!rule.verify)||((!lexicon.lexicon[token])||~lexicon.lexicon[token].split("|").indexOf(rule.to)))) this.tags[index] = rule.to;
				continue;
			}
			
			else if (type === brillConditions.PREV1OR2WD) {
				tmp = this.tokens[index - 1] || '';
				tmp2 = this.tokens[index - 2] || '';
				if (tmp.toLowerCase() === rule.c1 || tmp2.toLowerCase() === rule.c1 && ((!rule.verify)||((!lexicon.lexicon[token])||~lexicon.lexicon[token].split("|").indexOf(rule.to)))) this.tags[index] = rule.to;
				continue;
			}
			
			else if (type === brillConditions.PREV1OR2TAG) {
				tmp = this.tags[index - 1] || '';
				tmp2 = this.tags[index - 2] || '';
				if (tmp === rule.c1 || tmp2 === rule.c1 && ((!rule.verify)||((!lexicon.lexicon[token])||~lexicon.lexicon[token].split("|").indexOf(rule.to)))) this.tags[index] = rule.to;
				continue;
			}

			else if (type === brillConditions.END) {
				if ((!this.tags[index+1]) && ((!rule.verify)||((!lexicon.lexicon[token])||~lexicon.lexicon[token].split("|").indexOf(rule.to)))) this.tags[index] = rule.to;
				continue;
			}
		}
	};



	private _Brill = function(){
		for (var i = 0; i < this.tags.length; i++) {
			if(this.blocked[i]) continue;
			this._applyBrillRule(i,1);
		}
		for (var i = 0; i < this.tags.length; i++) {
			if(this.blocked[i]) continue;
			this._applyBrillRule(i,2);
		}
	};



	private _PostBrill = function(){
		for (let i = 0; i < this.tags.length; i++) {

			if(this.blocked[i]) continue;

			let tag = this.tags[i];
			let token = this.tokens[i].toLowerCase();
			let prev1Tag = this.tags[i-1] || "";
			let prev2Tag = this.tags[i-2] || "";
			let prev3Tag = this.tags[i-3] || "";
			let next1Tag = this.tags[i+1] || "";
			let next2Tag = this.tags[i+2] || "";
			let prev1Token = (this.tokens[i-1] || "").toLowerCase();
			let prev2Token = (this.tokens[i-2] || "").toLowerCase();
			let next1Token = (this.tokens[i+1] || "").toLowerCase();
			let next2Token = (this.tokens[i+2] || "").toLowerCase();

			if(token === "like" && prev1Tag === "MD") {
				this.tags[i] = "VB";
				continue;
			}

			if(prev1Token === "was" && token.endsWith("ing")) {
				this.tags[i] = "VBG";
				continue;
			}

			if(prev1Tag === "PRP" && tag.startsWith("N")) {
				let alt = (lexicon.lexicon[token]||"").split("|").find(x=>!x.startsWith("N"));
				if(alt) {
					this.tags[i] = alt;
					continue;
				}
			}

			// token based transformations
			if(~["only","is","that","much","while","in"].indexOf(token)) {
				if(token === "only" && (next1Tag === "NN")) {
					this.tags[i] = "JJ";
					continue;
				}

				if(token === "is") {
					this.tags[i] = "VBZ";
					continue;
				}

				if(token === "that") {
					if(tag === "WDT" && (next1Tag.charAt(0) === "N" || next1Tag === "PRP" || next1Tag === "PRP$" || next1Tag === "WP" || next1Tag === "IN")) {
						this.tags[i] = "IN";
						continue;
					}
					if(prev1Tag === "TO") {
						this.tags[i] = "DT";
						continue;
					}
				}

				if(token === "much") {
					if(tag === "JJ" && next1Tag === "JJR" && prev1Tag !== "RB") {
						this.tags[i] = "RB";
						continue;
					}
					if(tag === "RB" && prev1Tag === "RB" && next1Token !== "as") {
						this.tags[i] = "JJ";
						continue;
					}
				}

				if(token === "in" && tag === "IN" && prev1Tag.charAt(0) === "V" && ~["walk","throw","move","go","cash","come","bring","lock","put","take"].indexOf(new inflectors.Inflectors(prev1Token).conjugate("VBP"))) {
					this.tags[i] = "RP";
					continue;
				}

				if(token === "while" && (prev1Tag === "DT" || (prev2Tag === "DT" && prev1Tag === "JJ"))) {
					this.tags[i] = "NN";
					continue;
				}
			}

			// WDT => IN
			if(tag === "WDT" && prev1Tag.startsWith("NN") && next1Tag === "JJ") {
				this.tags[i] = "IN";
				continue;
			}

			// am => RB
			if(~["am","a.m.","a.m","p.m","pm","p.m."].indexOf(token) && prev1Tag === "CD") {
				this.tags[i] = "RB";
				continue;
			}

			if(tag.charAt(0) === "R") {
				// RP => RB
				if(tag === "RP" && (prev1Tag.charAt(0)!=="V" || ~["get","be","go"].indexOf(new inflectors.Inflectors(prev1Token).conjugate("VBP")))) {
					this.tags[i] = "RB";
					continue;
				}

				// RB => WRB
				if(tag === "RB" && (token === "when" || token === "how")) {
					this.tags[i] = "WRB";
					continue;
				}
			}

			if(tag.charAt(0) === "J") {

				// JJR => RBR
				if(tag === "JJR" && (next1Tag === "RB" || ((next1Tag === "," || next1Tag === ".") && prev1Tag === "NN" && prev2Tag === "DT"))) {
					this.tags[i] = "RBR";
					continue;
				}

				// JJS => JJS
				if(tag === "JJS" && next1Tag === "RB") {
					this.tags[i] = "RBS";
					continue;
				}

				// JJ => NN|VBG
				if(tag === "JJ") {
					if(
						((next1Tag === "."||(!next1Tag)) && prev1Tag === "DT" && prev2Tag === "IN") ||
						(prev1Tag === "DT" && next1Tag === "TO" && ~(lexicon.lexicon[token]||"").indexOf("NN")) ||
						(next1Tag.charAt(0) === "V" && ~(lexicon.lexicon[token]||"").indexOf("NN")) ||
						(next1Tag === "MD" && ~(lexicon.lexicon[token]||"").indexOf("NN")) || false
						// (prev1Tag.charAt(0) === "V" && next1Tag === "DT" && ~(lexicon.lexicon[token]||"").indexOf("NN"))
					) {
						this.tags[i] = "NN";
						continue;
					}
					if(next1Tag === "JJ" && ~(lexicon.lexicon[token]||"").indexOf("VBG")) {
						this.tags[i] = "VBG";
						continue;
					}
				}

				// JJ => VBN
				if(tag === 'JJ' && (~["VBZ","VBD","VBP","VBG"].indexOf(prev1Tag)) && ~(lexicon.lexicon[token]||"").indexOf("VBN")) {
					if(~["TO","RB",".",",",""].indexOf(next1Tag) || (next2Token === "by" || next1Token === "by")) {
						this.tags[i] = "VBN";
						continue;
					}
				}
			}

			// NN => VB|VBP
			if(tag === "NN") {
				if(inflectors.infinitives[token]) {
					if(
						(prev1Tag === "CC" && prev2Tag === "VB" && prev3Tag === "TO")||
						((prev1Token === "n't" || prev1Token === "not") && ~["does","do","did"].indexOf(prev2Token))||
						(~["does","do","did"].indexOf(prev1Token))||
						(prev1Tag === "'" && prev2Tag === "TO")
					) {
						this.tags[i] = "VB";
						continue;
					}
				}
				if(~(lexicon.lexicon[token]||"").indexOf("VBP")) {
					if(
						(prev1Tag.charAt(0) === "N" && next1Tag === "DT")||
						(prev1Tag.charAt(0) === "N" && next1Tag === "PRP")
					) {
						this.tags[i] = "VBP";
						continue;
					}
				}
			}

			if(tag.charAt(0) === "V") {

				// VBZ => NN
				if(tag==="VBZ" && ~(lexicon.lexicon[token]||"").indexOf("NNS")) {
					if(next1Tag === "MD") {
						this.tags[i] = "NNS";
						continue;
					}
				}

				// VBP => VB
				if(tag === "VBP") {
					if(
						(prev1Tag === "CC" && prev2Tag === "VB" && prev3Tag === "TO")||
						((prev1Token === "n't" || prev1Token === "not") && ~["does","do","did"].indexOf(prev2Token))||
						(~["does","do","did"].indexOf(prev1Token))||
						(prev1Tag === "\"" && prev2Tag === "TO") ||
						(prev1Tag === "TO" || prev1Tag === "MD" || (prev1Tag === "RB" && prev2Tag==="MD")) ||
						(prev1Tag === "RB" && prev2Tag === "VBP")
					) {
						this.tags[i] = "VB";
						continue;
					}
				}

				// VBN => VBD
				if(tag === "VBN" && ~(lexicon.lexicon[token]||"").indexOf("VBD")) {
					if(
						(prev1Tag === "EX") ||
						(prev1Tag === "PRP") ||
						(prev1Tag === "RB" && prev2Tag === "PRP") ||
						(prev1Tag === "WDT" || prev1Tag === "WP") ||
						(token === "had" && !~["has","have","'ve"].indexOf(prev1Token)) ||
						(
							(prev1Tag.charAt(0) === "N" || prev1Tag === "\"" || (prev1Tag === "CC" && prev2Tag.charAt(0) === "N") || (prev1Tag === "RB" && prev2Tag.charAt(0) === "N")) &&
							(next1Tag === "." || next1Tag.charAt(0) === "N" || next1Tag.charAt(0) === "J" || next1Tag === "DT" || next1Token === "with" || next1Tag === "RB")
						)
					) {
						this.tags[i] = "VBD";
						continue;
					}
				}

				// VBD => VBN
				if(tag === "VBD" && prev1Token === "than" && ~(lexicon.lexicon[token]||"").indexOf("VBN")) {
					this.tags[i] = "VBN";
					continue;
				}

				// VBD => JJ | VBN
				if(tag==="VBD" && ~(lexicon.lexicon[token]||"").indexOf("VBN")){
					if(next1Tag.indexOf("N") === 0 && prev1Tag === "IN") {
						this.tags[i] = "JJ";
						continue;
					}

					if((prev1Tag==="RB")&&(
						(prev2Tag === "DT" && prev3Tag === "IN") ||
						(prev2Tag === "RB" && prev3Tag === "VBZ") ||
						((prev3Tag.indexOf("N") === 0 || prev3Tag === "PRP") && ~["VBZ","VBP","VBD"].indexOf(prev2Tag))
					)) {
						this.tags[i] = "VBN";
						continue;
					}

					if(
						(prev1Token === "as" && ~(lexicon.lexicon[token]||"").indexOf("VBN")) ||
						(prev1Tag === "DT" && prev2Tag === "IN") ||
						(prev1Tag === "VBP" && prev2Tag.startsWith("N") && prev3Tag === "DT") ||
						((prev2Tag === "MD"||prev2Tag === "TO") && prev1Tag === "VB") ||
						(prev1Tag === "VBD") ||
						(prev1Token === "has" || prev1Token === "have") ||
						(prev1Token === "being" || prev1Token === "be") ||
						(prev1Token === "been") ||
						(prev1Tag.startsWith("V") && next1Tag === "IN" && next2Tag.startsWith("N")) ||
						(next1Token === "by" && next2Tag !== "CD" && next2Tag !== "SYM")
					){
						this.tags[i] = "VBN";
						continue;
					}	
				}
			}
		}
	};

}


export {Tag}