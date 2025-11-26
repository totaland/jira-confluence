export function handleError(error) {
  if (error.response) {
    console.error(
      `Request failed (${error.response.status} ${error.response.statusText || ''})`
    );
    if (error.response.data) {
      console.error(
        typeof error.response.data === 'string'
          ? error.response.data
          : JSON.stringify(error.response.data, null, 2)
      );
    }
  } else if (error.request) {
    console.error('Request was made but no response received (network issue).');
  } else {
    console.error(error.message);
  }

  if (process.env.DEBUG) {
    console.error(error);
  }

  process.exit(1);
}
