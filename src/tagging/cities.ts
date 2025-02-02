/// <reference path="../../node_modules/@types/node/index.d.ts" />

import cities from "@fizz/cities-list";

import capitalize from "./capitalize";

export default function(token: string, sensitive?: boolean):string {
	if(!sensitive) token = capitalize(token);
	if(cities[token]) return "NNP";
	return "";
};