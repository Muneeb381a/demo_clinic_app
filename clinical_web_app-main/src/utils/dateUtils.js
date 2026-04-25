export const urduDate = (date) => {
    const options = {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    };
    
    return new Date(date).toLocaleDateString('ur-PK', options);
  };