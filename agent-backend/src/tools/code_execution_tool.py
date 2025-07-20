import sys
from typing import Dict, Type
from langchain.tools import BaseTool
import json
import subprocess

from langchain_core.pydantic_v1 import create_model, Field
from .global_tools import GlobalBaseTool
from models.mongo import Tool

class CodeExecutionTool(GlobalBaseTool):
    """
    Code execution tool
    Args:
        function_name (str): Name of the function. Has to be a valid python name. This name is used to call the function.
        properties_dict (dict): dictionary of tool.data.parameters.properties { proeprty_name: { type: string | number | boolean, ... } }
                                this dict is used to create a dynamic pydantic model for "args_schema"
    """
    name: str = ""
    description: str = ""
    code: str
    function_name: str
    properties_dict: Dict = None
    args_schema: Type = None

    def post_init(self):
        self.args_schema = create_model(f"{self.function_name}_model", **self.convert_args_dict_to_type(self.properties_dict))


    @classmethod
    def factory(cls, tool: Tool, **kargs):
        code_execution_tool = CodeExecutionTool(
            name=tool.name,
            description=tool.description,
            function_name=tool.data.name,
            code=tool.data.code,
            properties_dict=tool.data.parameters.properties if tool.data.parameters.properties else []
        )
        code_execution_tool.post_init()
        return code_execution_tool
    
    def convert_args_dict_to_type(self, args_schema: Dict):
        args_schema_pydantic = dict()
        for k, v in args_schema.items():
            args_schema_pydantic[k]=((str, None))
        return args_schema_pydantic
    
    def convert_str_args_to_correct_type(self, args):
        typed_args = dict()
        for k, v in args.items():
            prop = self.properties_dict[k]
            if prop:
                typed_args[k]=bool(v) if prop.type == "boolean" else (int(v) if prop.type == "integer" else str(v))
        return typed_args
    
    def _run(self, args_str: Dict):
        args = json.loads(args_str)
        typed_args = self.convert_str_args_to_correct_type(args)
        indented_code = self.code.replace("\n", "\n    ")
        function_parameters = ", ".join(args.keys())  # Extract the keys as parameter names
        formatted_function = f"""def {self.function_name}({function_parameters}):
    {indented_code}
res = {self.function_name}({", ".join([f"{k}={repr(v)}" for k, v in typed_args.items()])})
print(res)
"""
        if sys.platform != "win32":
            formatted_function = formatted_function.replace("\r\n", "\n")
        try:
            output = subprocess.check_output(['python', '-c', formatted_function], timeout=5) # 5 seconds
            print(output)
            return output
        except TimeoutError:
                return "Not data returned because the call to Code Execution Tool timedout"
