/// <reference path="../../node_modules/@types/node/index.d.ts" />

import names from "@fizz/humannames";

import capitalize from "./capitalize";

export default function(token:string,sensitive?:boolean):string{
	if(!sensitive) token = capitalize(token);
	if(names[token]) return "NNP";
	return "";
};